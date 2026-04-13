const API_BASE_URL = 'http://localhost:8055/api';
// Using a hardcoded mock user ID for demonstration
const USER_ID = 1;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Seed the DB if it's not seeded (for quick start demo)
        await fetch(`${API_BASE_URL}/seed`, { method: 'POST' }).catch(() => console.log('Seed failed or backend not running'));
        
        await fetchUserProfile();
        await fetchOrders();
        
        setupEventListeners();
    } catch (error) {
        console.error("Initialization error:", error);
        showToast("Error connecting to backend", true);
    }
});

async function fetchUserProfile() {
    const res = await fetch(`${API_BASE_URL}/users/${USER_ID}`);
    if (res.ok) {
        const user = await res.json();
        document.querySelector('.user-greeting').innerText = `Hi, ${user.name.split(' ')[0]}`;
    }
}

async function fetchOrders() {
    const res = await fetch(`${API_BASE_URL}/orders/${USER_ID}`);
    if (res.ok) {
        const orders = await res.json();
        renderOrders(orders);
    }
}

function renderOrders(orders) {
    const activeOrderCard = document.getElementById('activeOrderCard');
    const orderHistoryList = document.getElementById('orderHistoryList');
    
    // Sort logic mostly to put the pending ones on top
    const activeOrder = orders.find(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
    const pastOrders = orders.filter(o => o.status === 'Delivered' || o.status === 'Cancelled' || o.id !== (activeOrder ? activeOrder.id : -1));
    
    // Render Active
    if (activeOrder) {
        activeOrderCard.classList.remove('shimmer');
        activeOrderCard.innerHTML = `
            <div class="order-header">
                <span class="restaurant-name">${activeOrder.restaurant_name}</span>
                <span class="order-status status-${activeOrder.status.toLowerCase().replace(' ', '-')}">${activeOrder.status}</span>
            </div>
            <div class="order-amount">Total: $${activeOrder.total_amount.toFixed(2)}</div>
            <input type="hidden" id="activeOrderId" value="${activeOrder.id}">
        `;
    } else {
        activeOrderCard.classList.remove('shimmer');
        activeOrderCard.innerHTML = `<p>No active orders right now.</p>`;
    }
    
    // Render History
    orderHistoryList.innerHTML = pastOrders.map(order => `
        <div class="card order-card">
            <div class="order-header">
                <span class="restaurant-name">${order.restaurant_name}</span>
                <span class="order-status status-${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span>
            </div>
            <div class="order-amount">Total: $${order.total_amount.toFixed(2)}</div>
        </div>
    `).join('');
}

let websocket;
let audioContext;
let scriptNode;
let micStream; // Track mic stream for cleanup
let lastServerError = null; // Track server-sent errors
let nextPlayTime = 0; // Track the absolute time to play the next audio chunk

function createCallOverlay() {
    // Remove existing overlay if any
    const existing = document.getElementById('callOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'callOverlay';
    overlay.innerHTML = `
        <div class="call-screen">
            <div class="call-status" id="callStatus">Connecting...</div>
            <div class="call-visualizer">
                <div class="viz-ring ring-1"></div>
                <div class="viz-ring ring-2"></div>
                <div class="viz-ring ring-3"></div>
                <div class="viz-mic-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                </div>
            </div>
            <div class="call-transcript" id="callTranscript"></div>
            <button class="btn-end-call" id="btnEndCall">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                    <line x1="1" y1="1" x2="23" y2="23" stroke-width="2.5"></line>
                </svg>
                End Call
            </button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btnEndCall').addEventListener('click', () => {
        endCall();
    });
    
    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('active'));
    return overlay;
}

function updateCallStatus(text, isError = false) {
    const statusEl = document.getElementById('callStatus');
    if (statusEl) {
        statusEl.innerText = text;
        statusEl.style.color = isError ? 'var(--primary-color)' : 'var(--success-color)';
    }
}

function addCallTranscript(text) {
    const el = document.getElementById('callTranscript');
    if (el) {
        const line = document.createElement('div');
        line.className = 'transcript-line';
        line.textContent = text;
        el.appendChild(line);
        el.scrollTop = el.scrollHeight;
    }
}

function removeCallOverlay() {
    const overlay = document.getElementById('callOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }
}

function endCall() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }
    if (scriptNode) {
        try { scriptNode.disconnect(); } catch(e) {}
        scriptNode = null;
    }
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
        audioContext = null;
    }
    document.querySelector('.circle.pulse').style.backgroundColor = 'var(--primary-color)';
    removeCallOverlay();
}

function setupEventListeners() {
    document.getElementById('btnVoiceAgent').addEventListener('click', async () => {
        // If already in a call, end it
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            endCall();
            showToast("Call ended.");
            return;
        }

        // Reset error tracking
        lastServerError = null;

        // Show full-screen call UI
        createCallOverlay();
        
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            nextPlayTime = audioContext.currentTime; // Reset queue on call start
            const source = audioContext.createMediaStreamSource(micStream);
            scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
            
            updateCallStatus("Dialing voice agent...");

            // Connect to the standalone voice_agent_server
            websocket = new WebSocket('ws://localhost:8080/ws/voice');
            
            websocket.onopen = () => {
                document.querySelector('.circle.pulse').style.backgroundColor = '#28a745';
                updateCallStatus("Connected — speak now", false);
                
                source.connect(scriptNode);
                scriptNode.connect(audioContext.destination);
                
                scriptNode.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcm16 = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        let s = Math.max(-1, Math.min(1, inputData[i]));
                        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    if (websocket.readyState === WebSocket.OPEN) {
                        websocket.send(pcm16.buffer);
                    }
                };
            };
            
            websocket.onmessage = async (event) => {
                if (event.data instanceof Blob) {
                    // Audio from Gemini
                    const arrayBuffer = await event.data.arrayBuffer();
                    const view = new Int16Array(arrayBuffer);
                    const float32 = new Float32Array(view.length);
                    for (let i = 0; i < view.length; i++) {
                        float32[i] = view[i] / 32768.0;
                    }
                    const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
                    audioBuffer.getChannelData(0).set(float32);
                    const playSource = audioContext.createBufferSource();
                    playSource.buffer = audioBuffer;
                    playSource.connect(audioContext.destination);
                    
                    const currentTime = audioContext.currentTime;
                    if (nextPlayTime < currentTime) {
                        nextPlayTime = currentTime;
                    }
                    playSource.start(nextPlayTime);
                    nextPlayTime += audioBuffer.duration;
                } else {
                    // JSON messages from server
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === "error") {
                            console.error("Server error:", msg.message);
                            lastServerError = msg.message;
                            updateCallStatus(msg.message, true);
                            addCallTranscript("⚠ " + msg.message);
                        } else if (msg.type === "text") {
                            console.log("Agent:", msg.text);
                            addCallTranscript("🤖 " + msg.text);
                        }
                    } catch(e) {}
                }
            };
            
            websocket.onclose = () => {
                document.querySelector('.circle.pulse').style.backgroundColor = 'var(--primary-color)';
                if (scriptNode) { try { scriptNode.disconnect(); } catch(e) {} }
                if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
                
                if (lastServerError) {
                    // Keep overlay open to show the error for a moment
                    updateCallStatus(lastServerError, true);
                    setTimeout(() => {
                        removeCallOverlay();
                        showToast(lastServerError, true);
                    }, 3000);
                } else {
                    removeCallOverlay();
                    showToast("Call ended.");
                }
            };
            
            websocket.onerror = (e) => {
                console.error("WebSocket error:", e);
                updateCallStatus("Connection failed — is the voice server running?", true);
                setTimeout(() => {
                    endCall();
                    showToast("Could not connect to voice agent server.", true);
                }, 2500);
            };

        } catch (err) {
            console.error(err);
            removeCallOverlay();
            showToast("Microphone access denied or error.", true);
        }
    });

    document.getElementById('btnRequestRefund').addEventListener('click', async () => {
        const activeOrderIdEl = document.getElementById('activeOrderId');
        if (!activeOrderIdEl) {
            showToast("No active order to refund.", true);
            return;
        }
        
        const orderId = activeOrderIdEl.value;
        const res = await fetch(`${API_BASE_URL}/support/refund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: USER_ID, order_id: parseInt(orderId), reason: "Automated test refund request" })
        });
        
        if (res.ok) {
            showToast("Refund initiated!");
            await fetchOrders(); // refresh view
        } else {
            showToast("Failed to request refund.", true);
        }
    });
}

function showToast(message, isError = false) {
    const toast = document.getElementById('notificationToast');
    const msgEl = document.getElementById('toastMessage');
    
    msgEl.innerText = message;
    toast.style.backgroundColor = isError ? 'var(--primary-color)' : 'var(--success-color)';
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
