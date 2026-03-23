using UnityEngine;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine.Networking;

namespace DroneSimulator
{
    /// <summary>
    /// Socket.IO compatible WebSocket client for Unity.
    /// Handles connection to Python backend for real-time simulation sync.
    /// </summary>
    public class SocketIOClient : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Connection")]
        [SerializeField] private string serverUrl = "http://localhost:8000";
        [SerializeField] private bool autoConnect = true;
        [SerializeField] private float reconnectDelay = 2f;
        [SerializeField] private int maxReconnectAttempts = 5;

        [Header("Settings")]
        [SerializeField] private float pollingInterval = 0.05f; // 50ms = 20Hz for polling
        [SerializeField] private bool usePolling = true; // Fallback to HTTP polling

        [Header("Debug")]
        [SerializeField] private bool logMessages = true;

        #endregion

        #region Private Fields

        private string sessionId;
        private bool isConnected;
        private bool isConnecting;
        private int reconnectAttempts;
        private Queue<SocketIOMessage> messageQueue;
        private Dictionary<string, Action<string>> eventHandlers;
        private Coroutine pollingCoroutine;

        #endregion

        #region Properties

        public bool IsConnected => isConnected;
        public string SessionId => sessionId;

        #endregion

        #region Events

        public event Action OnConnected;
        public event Action OnDisconnected;
        public event Action<string> OnError;
        public event Action<string, string> OnMessage;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            messageQueue = new Queue<SocketIOMessage>();
            eventHandlers = new Dictionary<string, Action<string>>();
        }

        private void Start()
        {
            if (autoConnect)
            {
                Connect();
            }
        }

        private void Update()
        {
            // Process queued messages on main thread
            while (messageQueue.Count > 0)
            {
                var msg = messageQueue.Dequeue();
                ProcessMessage(msg);
            }
        }

        private void OnDestroy()
        {
            Disconnect();
        }

        #endregion

        #region Connection

        /// <summary>
        /// Connect to the Socket.IO server.
        /// </summary>
        public void Connect()
        {
            if (isConnected || isConnecting) return;

            isConnecting = true;
            StartCoroutine(ConnectRoutine());
        }

        /// <summary>
        /// Disconnect from the server.
        /// </summary>
        public void Disconnect()
        {
            isConnected = false;
            isConnecting = false;
            sessionId = null;

            if (pollingCoroutine != null)
            {
                StopCoroutine(pollingCoroutine);
                pollingCoroutine = null;
            }

            OnDisconnected?.Invoke();
            Log("Disconnected from server");
        }

        private IEnumerator ConnectRoutine()
        {
            Log($"Connecting to {serverUrl}...");

            // Socket.IO handshake
            string handshakeUrl = $"{serverUrl}/socket.io/?EIO=4&transport=polling";

            using (UnityWebRequest request = UnityWebRequest.Get(handshakeUrl))
            {
                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    // Parse handshake response
                    string response = request.downloadHandler.text;

                    // Socket.IO response format: "0{...json...}"
                    if (response.StartsWith("0"))
                    {
                        try
                        {
                            string json = response.Substring(1);
                            var handshake = JsonUtility.FromJson<HandshakeResponse>(json);
                            sessionId = handshake.sid;

                            isConnected = true;
                            isConnecting = false;
                            reconnectAttempts = 0;

                            Log($"Connected with session: {sessionId}");
                            OnConnected?.Invoke();

                            // Start polling for messages
                            if (usePolling)
                            {
                                pollingCoroutine = StartCoroutine(PollingRoutine());
                            }
                        }
                        catch (Exception e)
                        {
                            HandleConnectionError($"Handshake parse error: {e.Message}");
                        }
                    }
                    else
                    {
                        HandleConnectionError($"Invalid handshake response: {response}");
                    }
                }
                else
                {
                    HandleConnectionError($"Connection failed: {request.error}");
                }
            }
        }

        private void HandleConnectionError(string error)
        {
            isConnecting = false;
            Log(error, LogType.Error);
            OnError?.Invoke(error);

            // Attempt reconnection
            if (reconnectAttempts < maxReconnectAttempts)
            {
                reconnectAttempts++;
                Log($"Reconnecting in {reconnectDelay}s (attempt {reconnectAttempts}/{maxReconnectAttempts})");
                StartCoroutine(ReconnectRoutine());
            }
        }

        private IEnumerator ReconnectRoutine()
        {
            yield return new WaitForSeconds(reconnectDelay);

            if (!isConnected && !isConnecting)
            {
                Connect();
            }
        }

        #endregion

        #region Messaging

        /// <summary>
        /// Register a handler for a specific event.
        /// </summary>
        public void On(string eventName, Action<string> handler)
        {
            eventHandlers[eventName] = handler;
        }

        /// <summary>
        /// Remove handler for an event.
        /// </summary>
        public void Off(string eventName)
        {
            eventHandlers.Remove(eventName);
        }

        /// <summary>
        /// Emit an event to the server.
        /// </summary>
        public void Emit(string eventName, object data = null)
        {
            if (!isConnected)
            {
                Log("Cannot emit: not connected", LogType.Warning);
                return;
            }

            StartCoroutine(EmitRoutine(eventName, data));
        }

        private IEnumerator EmitRoutine(string eventName, object data)
        {
            // Socket.IO message format: 42["event", data]
            string json;
            if (data != null)
            {
                string dataJson = JsonUtility.ToJson(data);
                json = $"42[\"{eventName}\",{dataJson}]";
            }
            else
            {
                json = $"42[\"{eventName}\"]";
            }

            string url = $"{serverUrl}/socket.io/?EIO=4&transport=polling&sid={sessionId}";

            using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
            {
                byte[] bodyRaw = Encoding.UTF8.GetBytes(json);
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "text/plain;charset=UTF-8");

                yield return request.SendWebRequest();

                if (request.result != UnityWebRequest.Result.Success)
                {
                    Log($"Emit failed: {request.error}", LogType.Error);
                }
                else
                {
                    Log($"Emitted: {eventName}");
                }
            }
        }

        /// <summary>
        /// Emit with dictionary data (more flexible).
        /// </summary>
        public void EmitDict(string eventName, Dictionary<string, object> data)
        {
            if (!isConnected) return;

            StartCoroutine(EmitDictRoutine(eventName, data));
        }

        private IEnumerator EmitDictRoutine(string eventName, Dictionary<string, object> data)
        {
            string dataJson = DictionaryToJson(data);
            string json = $"42[\"{eventName}\",{dataJson}]";

            string url = $"{serverUrl}/socket.io/?EIO=4&transport=polling&sid={sessionId}";

            using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
            {
                byte[] bodyRaw = Encoding.UTF8.GetBytes(json);
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "text/plain;charset=UTF-8");

                yield return request.SendWebRequest();

                if (request.result != UnityWebRequest.Result.Success)
                {
                    Log($"Emit failed: {request.error}", LogType.Error);
                }
            }
        }

        #endregion

        #region Polling

        private IEnumerator PollingRoutine()
        {
            WaitForSeconds wait = new WaitForSeconds(pollingInterval);

            while (isConnected)
            {
                yield return PollForMessages();
                yield return wait;
            }
        }

        private IEnumerator PollForMessages()
        {
            string url = $"{serverUrl}/socket.io/?EIO=4&transport=polling&sid={sessionId}";

            using (UnityWebRequest request = UnityWebRequest.Get(url))
            {
                request.timeout = 30;
                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    string response = request.downloadHandler.text;
                    ParseMessages(response);
                }
                else if (request.result == UnityWebRequest.Result.ConnectionError)
                {
                    // Connection lost
                    Disconnect();
                    Connect();
                }
            }
        }

        private void ParseMessages(string response)
        {
            // Socket.IO can send multiple messages in one response
            // Format: <length>:<message><length>:<message>...

            int index = 0;
            while (index < response.Length)
            {
                // Find message type
                char messageType = response[index];

                switch (messageType)
                {
                    case '0': // Open
                        // Already handled in connect
                        index++;
                        break;

                    case '2': // Ping
                        // Respond with pong
                        StartCoroutine(SendPong());
                        index++;
                        break;

                    case '3': // Pong
                        index++;
                        break;

                    case '4': // Message
                        // Parse Socket.IO message
                        if (index + 1 < response.Length)
                        {
                            char subType = response[index + 1];
                            if (subType == '2') // Event
                            {
                                // Find the JSON array
                                int start = response.IndexOf('[', index);
                                int end = FindMatchingBracket(response, start);

                                if (start >= 0 && end > start)
                                {
                                    string msgJson = response.Substring(start, end - start + 1);
                                    ParseEventMessage(msgJson);
                                    index = end + 1;
                                }
                                else
                                {
                                    index++;
                                }
                            }
                            else
                            {
                                index += 2;
                            }
                        }
                        else
                        {
                            index++;
                        }
                        break;

                    default:
                        index++;
                        break;
                }
            }
        }

        private void ParseEventMessage(string json)
        {
            // Format: ["eventName", data]
            try
            {
                // Simple parsing - find event name
                int firstQuote = json.IndexOf('"');
                int secondQuote = json.IndexOf('"', firstQuote + 1);

                if (firstQuote >= 0 && secondQuote > firstQuote)
                {
                    string eventName = json.Substring(firstQuote + 1, secondQuote - firstQuote - 1);

                    // Find data (after the comma)
                    int commaIndex = json.IndexOf(',', secondQuote);
                    string data = "{}";

                    if (commaIndex >= 0)
                    {
                        int dataStart = commaIndex + 1;
                        int dataEnd = json.LastIndexOf(']');
                        if (dataEnd > dataStart)
                        {
                            data = json.Substring(dataStart, dataEnd - dataStart).Trim();
                        }
                    }

                    // Queue for processing on main thread
                    messageQueue.Enqueue(new SocketIOMessage { eventName = eventName, data = data });
                }
            }
            catch (Exception e)
            {
                Log($"Parse error: {e.Message}", LogType.Error);
            }
        }

        private void ProcessMessage(SocketIOMessage msg)
        {
            Log($"Received: {msg.eventName}");

            OnMessage?.Invoke(msg.eventName, msg.data);

            if (eventHandlers.TryGetValue(msg.eventName, out Action<string> handler))
            {
                handler?.Invoke(msg.data);
            }
        }

        private IEnumerator SendPong()
        {
            string url = $"{serverUrl}/socket.io/?EIO=4&transport=polling&sid={sessionId}";

            using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
            {
                byte[] bodyRaw = Encoding.UTF8.GetBytes("3");
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "text/plain;charset=UTF-8");

                yield return request.SendWebRequest();
            }
        }

        #endregion

        #region Utility

        private int FindMatchingBracket(string s, int start)
        {
            if (start < 0 || start >= s.Length || s[start] != '[') return -1;

            int depth = 1;
            for (int i = start + 1; i < s.Length; i++)
            {
                if (s[i] == '[') depth++;
                else if (s[i] == ']') depth--;

                if (depth == 0) return i;
            }

            return -1;
        }

        private string DictionaryToJson(Dictionary<string, object> dict)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("{");

            bool first = true;
            foreach (var kvp in dict)
            {
                if (!first) sb.Append(",");
                first = false;

                sb.Append($"\"{kvp.Key}\":");

                if (kvp.Value == null)
                {
                    sb.Append("null");
                }
                else if (kvp.Value is string str)
                {
                    sb.Append($"\"{str}\"");
                }
                else if (kvp.Value is bool b)
                {
                    sb.Append(b ? "true" : "false");
                }
                else if (kvp.Value is int || kvp.Value is float || kvp.Value is double)
                {
                    sb.Append(kvp.Value.ToString());
                }
                else if (kvp.Value is Dictionary<string, object> subDict)
                {
                    sb.Append(DictionaryToJson(subDict));
                }
                else if (kvp.Value is float[] floatArr)
                {
                    sb.Append("[");
                    sb.Append(string.Join(",", floatArr));
                    sb.Append("]");
                }
                else
                {
                    sb.Append(JsonUtility.ToJson(kvp.Value));
                }
            }

            sb.Append("}");
            return sb.ToString();
        }

        private void Log(string message, LogType type = LogType.Log)
        {
            if (!logMessages) return;

            string prefix = "[SocketIO] ";
            switch (type)
            {
                case LogType.Error:
                    Debug.LogError(prefix + message);
                    break;
                case LogType.Warning:
                    Debug.LogWarning(prefix + message);
                    break;
                default:
                    Debug.Log(prefix + message);
                    break;
            }
        }

        #endregion
    }

    #region Data Classes

    [Serializable]
    public class HandshakeResponse
    {
        public string sid;
        public string[] upgrades;
        public int pingInterval;
        public int pingTimeout;
    }

    public class SocketIOMessage
    {
        public string eventName;
        public string data;
    }

    #endregion
}
