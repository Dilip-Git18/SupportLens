import * as mediasoup from 'mediasoup';
import { config } from '../config/mediasoupConfig';

class MediasoupManager {
  private worker: mediasoup.types.Worker | null = null;
  private routers = new Map<string, mediasoup.types.Router>();
  private transports = new Map<string, mediasoup.types.WebRtcTransport>();
  private producers = new Map<string, mediasoup.types.Producer>();
  private consumers = new Map<string, mediasoup.types.Consumer>();

  // Maps sessionId -> Set of active producer IDs
  private sessionProducers = new Map<string, Set<string>>();
  // Maps sessionId -> Set of active transport IDs
  private sessionTransports = new Map<string, Set<string>>();

  // Initialize the Mediasoup worker
  public async initialize() {
    try {
      this.worker = await mediasoup.createWorker({
        logLevel: config.worker.logLevel,
        logTags: config.worker.logTags,
        rtcMinPort: config.worker.rtcMinPort,
        rtcMaxPort: config.worker.rtcMaxPort,
      });

      this.worker.on('died', () => {
        console.error('Mediasoup Worker died. Exiting process...');
        process.exit(1);
      });

      console.log('Mediasoup Worker successfully initialized');
    } catch (err) {
      console.error('Failed to start Mediasoup Worker:', err);
      throw err;
    }
  }

  // Get or create router for a specific support session
  public async getOrCreateRouter(sessionId: string): Promise<mediasoup.types.Router> {
    if (!this.worker) {
      throw new Error('Mediasoup Worker not initialized');
    }

    let router = this.routers.get(sessionId);
    if (!router) {
      router = await this.worker.createRouter({
        mediaCodecs: config.router.mediaCodecs,
      });
      this.routers.set(sessionId, router);
      this.sessionProducers.set(sessionId, new Set());
      this.sessionTransports.set(sessionId, new Set());
      console.log(`Created new Mediasoup Router for session: ${sessionId}`);
    }

    return router;
  }

  // Create WebRtcTransport on a session router
  public async createTransport(sessionId: string): Promise<{
    transport: mediasoup.types.WebRtcTransport;
    params: any;
  }> {
    const router = await this.getOrCreateRouter(sessionId);
    const transport = await router.createWebRtcTransport(config.webRtcTransport);

    // Track transport
    this.transports.set(transport.id, transport);
    this.sessionTransports.get(sessionId)?.add(transport.id);

    transport.on('dtlsstatechange', (dtlsState: any) => {
      if (dtlsState === 'closed') {
        this.closeTransport(transport.id);
      }
    });

    transport.on('@close', () => {
      console.log(`Transport closed: ${transport.id}`);
    });

    const params = {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };

    return { transport, params };
  }

  // Connect transport with client DTLS parameters
  public async connectTransport(transportId: string, dtlsParameters: any): Promise<void> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }
    await transport.connect({ dtlsParameters });
  }

  // Create producer on a transport
  public async createProducer(
    sessionId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: any
  ): Promise<mediasoup.types.Producer> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const producer = await transport.produce({ kind, rtpParameters });

    // Track producer
    this.producers.set(producer.id, producer);
    this.sessionProducers.get(sessionId)?.add(producer.id);

    producer.on('transportclose', () => {
      console.log(`Producer transport closed: ${producer.id}`);
      this.closeProducer(sessionId, producer.id);
    });

    return producer;
  }

  // Create consumer on a transport
  public async createConsumer(
    sessionId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: any
  ): Promise<{ consumer: mediasoup.types.Consumer; params: any }> {
    const router = await this.getOrCreateRouter(sessionId);
    const transport = this.transports.get(transportId);

    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer not found: ${producerId}`);
    }

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Router cannot consume producer: ${producerId}`);
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Consumer starts paused, must resume explicitly
    });

    // Track consumer
    this.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      console.log(`Consumer transport closed: ${consumer.id}`);
      this.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      console.log(`Consumer producer closed: ${consumer.id}`);
      this.consumers.delete(consumer.id);
    });

    const params = {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
    };

    return { consumer, params };
  }

  // Resume consumer
  public async resumeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer not found: ${consumerId}`);
    }
    await consumer.resume();
  }

  // Get active producers for a session (excluding client's own if needed, filter is handled by client or socket layer)
  public getSessionProducers(sessionId: string): { id: string; kind: 'audio' | 'video' }[] {
    const producerIds = this.sessionProducers.get(sessionId) || new Set();
    const result: { id: string; kind: 'audio' | 'video' }[] = [];
    
    producerIds.forEach((pId) => {
      const producer = this.producers.get(pId);
      if (producer) {
        result.push({
          id: producer.id,
          kind: producer.kind as 'audio' | 'video',
        });
      }
    });

    return result;
  }

  // Close producer helper
  public closeProducer(sessionId: string, producerId: string): void {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);
      this.sessionProducers.get(sessionId)?.delete(producerId);
      console.log(`Producer closed: ${producerId}`);
    }
  }

  // Close transport helper
  public closeTransport(transportId: string): void {
    const transport = this.transports.get(transportId);
    if (transport) {
      transport.close();
      this.transports.delete(transportId);
      console.log(`Transport closed and cleaned: ${transportId}`);
    }
  }

  // Clean up a session entirely (routers, transports, producers, consumers)
  public closeSession(sessionId: string): void {
    console.log(`Cleaning up Mediasoup session: ${sessionId}`);

    // Close all producers for this session
    const producerIds = this.sessionProducers.get(sessionId);
    if (producerIds) {
      producerIds.forEach((pId) => {
        this.producers.get(pId)?.close();
        this.producers.delete(pId);
      });
      this.sessionProducers.delete(sessionId);
    }

    // Close all transports for this session
    const transportIds = this.sessionTransports.get(sessionId);
    if (transportIds) {
      transportIds.forEach((tId) => {
        this.transports.get(tId)?.close();
        this.transports.delete(tId);
      });
      this.sessionTransports.delete(sessionId);
    }

    // Close router
    const router = this.routers.get(sessionId);
    if (router) {
      router.close();
      this.routers.delete(sessionId);
    }
  }
}

export const mediasoupManager = new MediasoupManager();
export default mediasoupManager;
