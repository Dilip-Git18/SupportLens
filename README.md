# SupportLens 🔍

**SupportLens** is a complete, real-time video-assisted customer support platform. It enables customer service agents to initiate secure, browser-based video calls and interactive chat rooms with customers without depending on third-party hosted video clouds (such as Twilio, Agora, or Vonage). 

All audio, video, and data channels are routed through a self-hosted **Mediasoup WebRTC SFU (Selective Forwarding Unit)**. Persistent state, message transcript logs, support notes, ratings, and operational events are tracked in **MongoDB**.

---

## 🔐 Demo Credentials & Role Switching

For testing and judging convenience:
- **Default Agent Credentials**:
  - **Email**: `agent@supportlens.com`
  - **Password**: `Password123!`
  - *(Note: A new Agent account can also be registered at any time on the landing page.)*

### 🔄 Role Switching Workflow (Judging Guide)
1. **Agent Login**: Open `http://localhost:3000`, click **Already have an agent account? Log in**, and enter the demo credentials.
2. **Launch a Support Link**: Create a support session on the dashboard and copy the secure invitation link.
3. **Join as Customer**: Open the invitation link in a **different browser window or Incognito tab**. Because the Incognito tab does not share the agent's authentication token, the system automatically identifies this tab as a guest and presents the Customer Pre-Join Screen. Entering a name and clicking "Start Live Session" joins them as the Customer.
4. **Join as Agent**: Go back to your main Agent Dashboard tab and click **Join Room** on that session. The agent will connect with the Agent Console toolbar, notes panel, and category managers.

---