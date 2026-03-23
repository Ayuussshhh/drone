using UnityEngine;
using System;
using System.Collections.Generic;

namespace DroneSimulator
{
    /// <summary>
    /// Synchronizes drone simulation between Unity and Python backend.
    /// Handles bidirectional state transfer and command processing.
    /// </summary>
    [RequireComponent(typeof(DroneController))]
    [RequireComponent(typeof(SocketIOClient))]
    public class SimulationSync : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Sync Settings")]
        [SerializeField] private SyncMode syncMode = SyncMode.SendOnly;
        [SerializeField] private float sendRate = 20f; // Hz
        [SerializeField] private bool syncOnStart = true;

        [Header("Interpolation")]
        [SerializeField] private bool enableInterpolation = true;
        [SerializeField] private float interpolationFactor = 0.5f;

        [Header("Debug")]
        [SerializeField] private bool logSync = false;

        #endregion

        #region Private Fields

        private DroneController droneController;
        private SocketIOClient socketClient;
        private float lastSendTime;
        private bool isSimulationActive;

        // Received state for interpolation
        private NetworkDroneState receivedState;
        private NetworkDroneState previousState;

        #endregion

        #region Properties

        public bool IsConnected => socketClient != null && socketClient.IsConnected;
        public bool IsSimulationActive => isSimulationActive;
        public SyncMode Mode => syncMode;

        #endregion

        #region Events

        public event Action OnSimulationStarted;
        public event Action OnSimulationStopped;
        public event Action<NetworkDroneState> OnStateReceived;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            droneController = GetComponent<DroneController>();
            socketClient = GetComponent<SocketIOClient>();
        }

        private void Start()
        {
            SetupEventHandlers();

            if (syncOnStart)
            {
                socketClient.OnConnected += OnConnected;
            }
        }

        private void Update()
        {
            if (!IsConnected) return;

            // Send state at specified rate
            if (syncMode == SyncMode.SendOnly || syncMode == SyncMode.Bidirectional)
            {
                if (Time.time - lastSendTime >= 1f / sendRate)
                {
                    SendDroneState();
                    lastSendTime = Time.time;
                }
            }

            // Apply received state
            if (syncMode == SyncMode.ReceiveOnly || syncMode == SyncMode.Bidirectional)
            {
                if (receivedState != null && enableInterpolation)
                {
                    ApplyReceivedState();
                }
            }
        }

        private void OnDestroy()
        {
            if (socketClient != null)
            {
                socketClient.OnConnected -= OnConnected;
            }
        }

        #endregion

        #region Event Handlers

        private void SetupEventHandlers()
        {
            // Register for server events
            socketClient.On("simulation_state", OnSimulationState);
            socketClient.On("simulation_started", OnSimulationStartedHandler);
            socketClient.On("simulation_stopped", OnSimulationStoppedHandler);
            socketClient.On("parameters_updated", OnParametersUpdated);
            socketClient.On("error", OnServerError);
            socketClient.On("connected", OnServerConnected);
        }

        private void OnConnected()
        {
            Log("Connected to backend, sending configuration...");
            SendConfiguration();
        }

        private void OnServerConnected(string data)
        {
            Log($"Server acknowledged connection: {data}");
        }

        private void OnSimulationState(string data)
        {
            try
            {
                var wrapper = JsonUtility.FromJson<SimulationStateWrapper>(data);

                if (wrapper.state != null)
                {
                    previousState = receivedState;
                    receivedState = wrapper.state;
                    OnStateReceived?.Invoke(receivedState);
                }
            }
            catch (Exception e)
            {
                Log($"Error parsing state: {e.Message}", true);
            }
        }

        private void OnSimulationStartedHandler(string data)
        {
            isSimulationActive = true;
            OnSimulationStarted?.Invoke();
            Log("Simulation started");
        }

        private void OnSimulationStoppedHandler(string data)
        {
            isSimulationActive = false;
            OnSimulationStopped?.Invoke();
            Log("Simulation stopped");
        }

        private void OnParametersUpdated(string data)
        {
            Log("Parameters updated");
        }

        private void OnServerError(string data)
        {
            Log($"Server error: {data}", true);
        }

        #endregion

        #region State Sync

        private void SendDroneState()
        {
            if (droneController.CurrentState == null) return;

            var state = droneController.CurrentState;

            var stateData = new Dictionary<string, object>
            {
                { "timestamp", state.timestamp },
                { "position", new Dictionary<string, object>
                    {
                        { "x", state.position.x },
                        { "y", state.position.y },
                        { "z", state.position.z }
                    }
                },
                { "velocity", new Dictionary<string, object>
                    {
                        { "x", state.velocity.x },
                        { "y", state.velocity.y },
                        { "z", state.velocity.z }
                    }
                },
                { "rotation", new Dictionary<string, object>
                    {
                        { "x", state.rotation.x },
                        { "y", state.rotation.y },
                        { "z", state.rotation.z }
                    }
                },
                { "motor_thrusts", state.motorThrusts },
                { "tether_tension", state.tetherTension },
                { "flight_status", state.flightStatus.ToString().ToLower() }
            };

            socketClient.EmitDict("unity_state_update", stateData);
        }

        private void ApplyReceivedState()
        {
            if (receivedState == null) return;

            // Convert to Unity DroneState
            DroneState unityState = new DroneState
            {
                timestamp = receivedState.timestamp,
                position = new Vector3(
                    receivedState.position.x,
                    receivedState.position.y,
                    receivedState.position.z
                ),
                velocity = new Vector3(
                    receivedState.velocity.x,
                    receivedState.velocity.y,
                    receivedState.velocity.z
                ),
                rotation = new Vector3(
                    receivedState.rotation.x,
                    receivedState.rotation.y,
                    receivedState.rotation.z
                ),
                motorThrusts = receivedState.motor_thrusts
            };

            // Apply to drone controller
            droneController.ApplyNetworkState(unityState);
        }

        #endregion

        #region Commands

        /// <summary>
        /// Send drone configuration to backend.
        /// </summary>
        public void SendConfiguration()
        {
            var config = droneController.GetConfiguration();
            socketClient.EmitDict("drone_config", config);
        }

        /// <summary>
        /// Request backend to start simulation.
        /// </summary>
        public void StartSimulation(float updateRate = 50f)
        {
            var config = BuildDroneConfiguration();

            var data = new Dictionary<string, object>
            {
                { "config", config },
                { "update_rate", updateRate },
                { "parameters", new Dictionary<string, object>
                    {
                        { "enable_wind", true },
                        { "enable_tether", droneController.GetComponentInChildren<TetherController>() != null }
                    }
                }
            };

            socketClient.EmitDict("start_simulation", data);
        }

        /// <summary>
        /// Request backend to stop simulation.
        /// </summary>
        public void StopSimulation()
        {
            socketClient.Emit("stop_simulation");
        }

        /// <summary>
        /// Update motor throttles on backend.
        /// </summary>
        public void UpdateThrottles(float[] throttles)
        {
            var data = new Dictionary<string, object>
            {
                { "throttles", throttles }
            };
            socketClient.EmitDict("update_throttles", data);
        }

        /// <summary>
        /// Update wind parameters on backend.
        /// </summary>
        public void UpdateWind(Vector3 velocity, float turbulence)
        {
            var data = new Dictionary<string, object>
            {
                { "velocity", new Dictionary<string, object>
                    {
                        { "x", velocity.x },
                        { "y", velocity.y },
                        { "z", velocity.z }
                    }
                },
                { "turbulence", turbulence }
            };
            socketClient.EmitDict("set_wind", data);
        }

        /// <summary>
        /// Send gesture command to backend.
        /// </summary>
        public void SendGestureCommand(string gesture, Dictionary<string, object> parameters)
        {
            var data = new Dictionary<string, object>
            {
                { "gesture", gesture },
                { "parameters", parameters }
            };
            socketClient.EmitDict("gesture_command", data);
        }

        /// <summary>
        /// Request current state from backend.
        /// </summary>
        public void RequestState()
        {
            socketClient.Emit("get_state");
        }

        /// <summary>
        /// Reset simulation on backend.
        /// </summary>
        public void ResetSimulation()
        {
            socketClient.Emit("reset_simulation");
            droneController.ResetDrone();
        }

        #endregion

        #region Configuration Builder

        private Dictionary<string, object> BuildDroneConfiguration()
        {
            // Build a configuration dictionary matching the backend schema
            var motors = new List<Dictionary<string, object>>();
            var propellers = new List<Dictionary<string, object>>();

            // Get motor controllers
            var motorControllers = droneController.GetComponentsInChildren<MotorController>();

            for (int i = 0; i < motorControllers.Length; i++)
            {
                var motor = motorControllers[i];
                var pos = motor.transform.localPosition;

                motors.Add(new Dictionary<string, object>
                {
                    { "id", $"motor_{i}" },
                    { "name", $"Motor {i + 1}" },
                    { "motor_type", "brushless" },
                    { "mass", 0.05f },
                    { "kv_rating", 920f },
                    { "thrust_constant", 1.5e-5f },
                    { "max_rpm", 12000f },
                    { "max_current", 20f },
                    { "position", new Dictionary<string, object>
                        {
                            { "x", pos.x },
                            { "y", pos.y },
                            { "z", pos.z }
                        }
                    },
                    { "rotation_direction", motor.Direction == RotationDirection.Clockwise ? 1 : -1 }
                });

                propellers.Add(new Dictionary<string, object>
                {
                    { "id", $"prop_{i}" },
                    { "name", "10x4.5 Propeller" },
                    { "diameter", 0.254f },
                    { "pitch", 0.114f },
                    { "mass", 0.015f },
                    { "blade_count", "2-blade" }
                });
            }

            var config = new Dictionary<string, object>
            {
                { "id", droneController.DroneId },
                { "name", "Unity Drone" },
                { "motors", motors },
                { "propellers", propellers },
                { "battery", new Dictionary<string, object>
                    {
                        { "id", "battery_1" },
                        { "name", "4S 5000mAh" },
                        { "battery_type", "LiPo" },
                        { "cell_count", 4 },
                        { "capacity_mah", 5000f },
                        { "mass", 0.5f },
                        { "max_discharge_rate", 50f }
                    }
                },
                { "frame", new Dictionary<string, object>
                    {
                        { "id", "frame_1" },
                        { "name", "Quadcopter Frame" },
                        { "frame_type", "quad_x" },
                        { "mass", 0.3f },
                        { "arm_length", 0.225f },
                        { "diagonal_distance", 0.45f },
                        { "frontal_area", 0.04f }
                    }
                }
            };

            // Add tether if present
            var tether = droneController.GetComponentInChildren<TetherController>();
            if (tether != null && tether.IsEnabled)
            {
                config["tether"] = new Dictionary<string, object>
                {
                    { "id", "tether_1" },
                    { "name", "Window Cleaning Tether" },
                    { "tether_type", "synthetic" },
                    { "length", 10f },
                    { "mass_per_meter", 0.05f },
                    { "diameter", 0.005f },
                    { "stiffness", 10000f },
                    { "damping", 100f },
                    { "breaking_strength", 5000f }
                };
            }

            return config;
        }

        #endregion

        #region Utility

        public void SetSyncMode(SyncMode mode)
        {
            syncMode = mode;
            droneController.SetNetworkControlled(mode == SyncMode.ReceiveOnly);
        }

        private void Log(string message, bool isError = false)
        {
            if (!logSync && !isError) return;

            string prefix = "[SimSync] ";
            if (isError)
                Debug.LogError(prefix + message);
            else
                Debug.Log(prefix + message);
        }

        #endregion
    }

    #region Enums and Data Classes

    /// <summary>
    /// Synchronization mode between Unity and backend.
    /// </summary>
    public enum SyncMode
    {
        SendOnly,      // Unity sends state to backend
        ReceiveOnly,   // Unity receives state from backend (backend drives physics)
        Bidirectional  // Both directions (for validation/comparison)
    }

    /// <summary>
    /// Network format for drone state (matches backend schema).
    /// </summary>
    [Serializable]
    public class NetworkDroneState
    {
        public float timestamp;
        public Vector3Data position;
        public Vector3Data velocity;
        public Vector3Data acceleration;
        public Vector3Data rotation;
        public Vector3Data angular_velocity;
        public float[] motor_thrusts;
        public float tether_tension;
        public float tether_angle;
        public float altitude;
        public string flight_status;
    }

    [Serializable]
    public class Vector3Data
    {
        public float x;
        public float y;
        public float z;
    }

    [Serializable]
    public class SimulationStateWrapper
    {
        public NetworkDroneState state;
        public object metrics;
        public object stability;
    }

    #endregion
}
