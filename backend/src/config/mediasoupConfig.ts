import { RtpCodecCapability, WorkerLogLevel, WorkerLogTag } from 'mediasoup/node/lib/types';

export const config = {
  // Mediasoup Worker settings
  worker: {
    logLevel: 'warn' as WorkerLogLevel,
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
    ] as WorkerLogTag[],
    rtcMinPort: parseInt(process.env.MIN_PORT || '20000', 10),
    rtcMaxPort: parseInt(process.env.MAX_PORT || '20200', 10),
  },

  // Router settings
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
    ] as RtpCodecCapability[],
  },

  // WebRtcTransport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIA_IP || '127.0.0.1',
        announcedIp: process.env.MEDIA_ANNOUNCED_IP || '127.0.0.1',
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  },
};
