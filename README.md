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

## 🏗️ Architecture & Flow Diagram

SupportLens utilizes a dedicated Express.js backend for REST API endpoints and Socket.IO for WebRTC signaling and real-time state broadcasts. The media traffic itself is routed directly through a spawned Mediasoup Worker subprocess on the server.

```mermaid
flowchart TD
    subgraph Frontend [SupportLens Frontend - Next.js 15]
        A[Agent Dashboard] <--> |REST API| D[Next.js Server Actions / Client HTTP]
        B[Support Session Page] <--> |Signaling & Chat| E[Socket.IO Client]
        B <--> |WebRTC Media Streams| F[Mediasoup Client]
      
        style A fill:#4f46e5,stroke:#4f46e5,color:#fff
        style B fill:#4f46e5,stroke:#4f46e5,color:#fff
    end

    subgraph Backend [SupportLens Backend - Node.js & Express]
        G[Express App] <--> |REST Endpoints| D
        H[Socket.IO Server] <--> |Signaling & Chat Events| E
        I[Mediasoup worker] <--> |Create Router / Transports| F
        G <--> |Mongoose ORM| J[(MongoDB Atlas)]
        G <--> |File Storage| K[Local Uploads Folder]
      
        style G fill:#0f172a,stroke:#334155,color:#fff
        style H fill:#0f172a,stroke:#334155,color:#fff
        style I fill:#0d9488,stroke:#0d9488,color:#fff
    end
    
    H <--> |Coordinate Media Transports| I
```

---

## 🛠️ Technology Stack

### Backend
- **Node.js & Express.js**: Lightweight, scalable API layer.
- **Socket.IO**: Real-time events framework for signaling media setups, chat channels, and presence logs.
- **Mediasoup**: Ultra-fast Selective Forwarding Unit (SFU) written in C++ (run as Node worker bindings).
- **Mongoose / MongoDB**: Persistent storage for sessions, messages, ratings, notes, and session timeline events.
- **Multer**: Local multipart upload engine for PDF/Image sharing.

### Frontend
- **Next.js 15 (App Router)**: React framework with App router.
- **TypeScript**: Full typing coverage across components.
- **Tailwind CSS v4**: Theme styling, custom glassmorphism panels, and transitions.
- **Lucide React**: Modern icon primitives.
- **mediasoup-client**: Standard WebRTC client-side transport wrapper.

---

## ⚙️ Quick Start Setup Guide

### 1. Prerequisites
- **Node.js**: `v18+` or `v20+` (Recommended)
- **MongoDB**: Access to a MongoDB Atlas cluster or running local instance (use the connection string provided in environment configuration).
- **Mediasoup compilation utilities**:
  - *macOS*: Installed by default when Xcode command line tools are configured.
  - *Linux*: Requires `python3`, `make`, and a C++ compiler (`g++` or `clang++`).

---

### 2. Backend Installation & Start
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies (this will trigger compilation of the Mediasoup worker binaries for your OS):
   ```bash
   npm install
   ```
3. Verify the `.env` file exists and is populated:
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://dilip18109mn_db_user:UzNFi2FwO19wzi8v@cluster9atom.lnotnfh.mongodb.net/supportlens?retryWrites=true&w=majority
   JWT_SECRET=supportlens_super_jwt_secret_key_123!@#
   FRONTEND_URL=http://localhost:3000
   NODE_ENV=development
   
   # For local hosting, use 127.0.0.1. If testing on a local LAN across devices, use your local network IP (e.g. 192.168.1.x)
   MEDIA_IP=127.0.0.1
   MEDIA_ANNOUNCED_IP=127.0.0.1
   ```
4. Start the backend in development hot-reload mode:
   ```bash
   npm run dev
   ```

The backend server will connect to MongoDB, initialize the Mediasoup worker, and start listening on port `5000`.

---

### 3. Frontend Installation & Start
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📝 Demo Workflow Script

Follow this sequence to test and demonstrate all features of the application:

1. **Agent Setup**:
   - Navigate to [http://localhost:3000](http://localhost:3000).
   - Toggle "Sign up" and create a new Agent account (Name, Email, Password).
   - You will be redirected to the **Agent Dashboard**.

2. **Session Creation**:
   - In the Agent Dashboard, click the **Create Session** button.
   - Enter a client's name (e.g., "John Doe") and select a category tag (e.g., "Technical Support").
   - A modal will open displaying a **QR Code** and a **Secure Invite Link**.
   - Copy the link. Click "Done".

3. **Customer Joining**:
   - Open a separate browser window (preferably in Incognito mode to avoid session storage crossover).
   - Paste the copied invite link.
   - You will see the **Secure Live Support** joining screen.
   - Input the customer name "John Doe" and click **Start Live Session**.
   - The browser will ask for camera/mic permissions. Allow them.

4. **Agent Joining**:
   - Back in the Agent Dashboard window, look under **Active Calls**.
   - You will see the newly created session with John Doe.
   - Click **Join Room** to connect the agent to the call. Allow media permissions.

5. **Live Communication & Controls**:
   - Both windows should now show local (picture-in-picture) and remote video streams.
   - Toggle the **Camera** on/off button on either page; the remote user's view will adjust instantly.
   - Toggle the **Microphone** mute button; note the mute status badge update for that user.

6. **Real-time Chat & Document Sharing**:
   - Send messages in the chat panels on both sides. Observe instant delivery.
   - Click the **Paperclip icon** in the chat panel. Select a file (an image or a PDF up to 10MB).
   - Uploading begins, and once complete, it is displayed in the chat feed with a download/view link.

7. **Agent Support Assistance**:
   - In the Agent's view, locate the **Agent Assistance Panel** on the right side.
   - Add troubleshoot notes (e.g., "Instructed client to restart router. Configured port forwarding.").
   - Change the category if needed and click **Save Notes & Tag**.

8. **Reconnection (Extra Credit Demonstration)**:
   - On the customer page, trigger a temporary connection loss by refreshing the browser tab.
   - In the Agent's window, observe the flashing warning badge: **"John Doe (customer) connection unstable. Reconnecting... (9s...)"**.
   - Enter a name on the customer pre-join screen again and click "Start Live Session".
   - The warning badge disappears immediately, and the call and chat logs resume seamlessly without losing state.

9. **Ending the Call & Client Rating**:
   - In the Agent's window, click the red **End Support** button. Confirm the dialog.
   - The Agent is redirected to the Agent Dashboard.
   - In the Customer's window, the call ends automatically, and the **Support Session Completed** modal pops up.
   - Submit a **5-star review** with comments (e.g., "Agent was extremely helpful and resolved the problem quickly!") and click **Submit Feedback**.
   - The customer is redirected to the secure end page.

10. **Viewing History and Logs**:
    - Back on the Agent Dashboard, click the **Session History** tab.
    - Search for "John Doe" or look at the list. Click **Transcript** next to John Doe's session.
    - A summary drawer slides open showing the **Customer Review score**, the **Agent Session Notes**, the **Full Chat Transcript**, and the **Audit Timeline Events Log** (join times, media toggles, file uploads, ratings, etc.) stored in MongoDB.

---

## 🚀 Hosting on Render (Deployment Guide)

This section explains how to deploy both the **SupportLens Frontend** (Next.js) and **SupportLens Backend** (Node.js/Express) to Render.

> [!IMPORTANT]
> **WebRTC & Mediasoup SFU Hosting Constraint**: 
> Mediasoup routes raw media streams through dynamically-allocated UDP ports (ports `20000–20200` in our config). 
> Tiers on PaaS services like Render only expose a single HTTP port (`80/443`) through their load balancer. 
> While you can deploy the **Signaling and Express server on Render** and the **Frontend on Render** for demonstrating chat, notes, dashboards, ratings, and events, the WebRTC audio/video streams require hosting the backend on a VPS (like a DigitalOcean Droplet, AWS EC2, or GCP VM) where open port mapping is supported.

### 1. Deploying the Backend (Node.js + Express) on Render
1. Create a **Web Service** on Render.
2. Link your Git repository.
3. Configure the following settings:
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
4. In the **Environment Variables** tab, add:
   - `PORT`: `10000` (Render overrides this, but it serves as a backup)
   - `MONGODB_URI`: `mongodb+srv://dilip18109mn_db_user:UzNFi2FwO19wzi8v@cluster9atom.lnotnfh.mongodb.net/supportlens?retryWrites=true&w=majority`
   - `JWT_SECRET`: `your_custom_jwt_secret_key`
   - `FRONTEND_URL`: `https://your-frontend-domain.onrender.com` (Your Render frontend URL)
   - `NODE_ENV`: `production`
   - `MEDIA_IP`: `0.0.0.0`
   - `MEDIA_ANNOUNCED_IP`: `your-backend-domain.onrender.com`

### 2. Deploying the Frontend (Next.js) on Render
Next.js 15 App Router applications are best deployed as **Web Services** on Render:
1. Create a **Web Service** on Render.
2. Link your Git repository.
3. Configure the following settings:
   - **Environment**: `Node`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Start Command**: `cd frontend && npm start`
4. In the **Environment Variables** tab, add:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-domain.onrender.com/api` (Point to your backend URL)
