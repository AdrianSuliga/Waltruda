const express = require("express");
const bcrypt = require("bcrypt");
const mqtt = require("mqtt");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");
const io = new Server(server);

const client = mqtt.connect("mqtt://broker.hivemq.com:1883", {
  clientId: randomUUID(),
  clean: false,
  connectTimeout: 5000,
  username: null,
  password: null,
  reconnectPeriod: 1000,
});
const port = 3000;
const hashSalt = 10;

const shutdown_topic = "sbt/workshop/waltruda/shutdown";
const telemetry_topic = "sbt/workshop/waltruda/telemetry";
const profile_topic = "sbt/workshop/waltruda/profile";

/*
 * This is hash of default admin password. It is set here to make sure
 * we know which password is set in case of server reset.
 */
let adminHash = "$2b$10$ALAOwj8yi5MdKfVNGwTGRei19iuWAzzEiJNEXiTtqOAXHK/8/ZJnm";

let chart_points = [];
let profile_points = [];
let current_mode = 0;
let current_avg = 0.0;
let current_status = "SITE NOT CONNECTED";

app.use(express.static("public"));
app.use(express.json());

server.listen(port, () => {
  console.log("App listening on port", port);
});

io.on("connection", (socket) => {
  socket.emit("profile-data", {
    profile_points: profile_points,
  });
  socket.emit("connection-data", {
    status: current_status,
  });
});

// Connection to MQTT broker
client.on("connect", () => {
  console.log("Broker connected");
  current_status = "ESTABLISHED";
  io.emit("connection-data", { status: current_status });
  client.subscribe(telemetry_topic, (err) => {
    if (err) {
      console.error("Subscription failed with", err);
    } else {
      console.log("Subscribed to", telemetry_topic);
    }
  });
  client.subscribe(profile_topic, (err) => {
    if (err) {
      console.error("Subsciption failed with", err);
    } else {
      console.log("Subscribed to", profile_topic);
    }
  });
});

client.on("message", (topic, payload) => {
  if (topic === telemetry_topic) {
    handleTelemetryData(payload);
  } else if (topic === profile_topic) {
    handleProfileData(payload);
  } else {
    console.error("Message received on unrecognized topic:", topic);
  }
});

client.on("offline", () => {
  current_status = "SITE NOT CONNECTED";
  io.emit("connection-data", { status: current_status });
});

client.on("close", () => {
  current_status = "SITE NOT CONNECTED";
  io.emit("connection-data", { status: current_status });
});

app.get("/", (req, res) => {
  res.sendFile("/public/index.html", { root: __dirname });
});

// Handle changing admin password
app.post("/change_password", (req, res) => {
  if (bcrypt.compareSync(req.body.oldPassword, adminHash)) {
    adminHash = bcrypt.hashSync(req.body.newPassword, hashSalt);
    return res.status(200).json({ info: "Password changed" });
  } else {
    return res.status(403).json({ info: "Wrong password" });
  }
});

// Handle sending shutdown message
app.post("/shutdown", (req, res) => {
  if (bcrypt.compareSync(req.body.password, adminHash)) {
    client.publish(
      shutdown_topic,
      "SHUTDOWN",
      { qos: 0, retain: false },
      (err) => {
        if (err) {
          console.error(err);
        }
      }
    );
    return res.status(200).json({ info: "OK" });
  } else {
    return res.status(403).json({ info: "Wrong password" });
  }
});

function handleTelemetryData(payload) {
  // Read telemetry data from payload
  let now = new Date();
  let temps = [];

  // First 16 bytes have 4 floats with thermistor readings
  for (let i = 0; i < 13; i += 4) {
    temps.push(
      parseFloat(
        payload
          .subarray(i, i + 4)
          .readFloatLE()
          .toFixed(2)
      )
    );
  }

  // Next 12 bytes have 3 floats representing duty cycle,
  // desired temperature and profile progress
  let duty_cycle = payload.subarray(16, 20).readFloatLE().toFixed(2);
  let desired_temp = payload.subarray(20, 24).readFloatLE().toFixed(2);
  let profile_progress_min = payload.subarray(24, 28).readFloatLE().toFixed(2);
  // Next 6 bytes have one enum and 2 bools represnting heater operating mode,
  // state of fan and of vacuum pump
  let new_mode = payload.subarray(28, 32).readInt32LE();
  let fan_on = payload.subarray(32).readUInt8();
  let vacuum_on = payload.subarray(33).readUInt8();

  let avg = parseFloat(
    ((temps[0] + temps[1] + temps[2] + temps[3]) / 4).toFixed(2)
  );
  current_avg = avg;

  // if mode changes
  if (new_mode !== current_mode) {
    if (current_mode === 1) {
      // if mode is profile and it needs to switch than
      profile_points = []; // reset profile chart
      io.emit("profile-data", {
        profile_points: [],
      });
    }
    chart_points = [];
    current_mode = new_mode;
  }

  chart_points.push({
    x: now,
    y: avg,
  });

  for (let i = 0; i < temps.length; i++) {
    temps[i] = temps[i] + " °C";
  }

  io.emit("mqtt-data", {
    temps: temps,
    desired_temp: desired_temp + " °C",
    duty_cycle: duty_cycle + " %",
    progress_min: String(profile_progress_min),
    mode: parseMode(new_mode),
    chart_points: chart_points,
    fan_on: parseBool(fan_on),
    vacuum_on: parseBool(vacuum_on),
  });
}

function handleProfileData(payload) {
  let now = new Date();
  let size = payload.subarray(0, 4).readInt32LE();
  cp_sections = [];
  for (let i = 1; i <= size; i++) {
    cp_sections.push([]);
    cp_sections[i - 1].push(payload.subarray(8 * i - 4, 8 * i).readFloatLE());
    cp_sections[i - 1].push(payload.subarray(8 * i, 8 * i + 1).readUInt8());
    cp_sections[i - 1].push(payload.subarray(8 * i + 1, 8 * i + 2).readUInt8());
    cp_sections[i - 1].push(
      payload.subarray(8 * i + 2, 8 * i + 4).readUInt16LE()
    );
  }

  profile_points = [];
  let durations = [];
  let ramps = [];
  let temp = current_avg;
  let additional_time = 0;

  for (let i = 0; i < size; i++) {
    ramps.push(cp_sections[i][0]);
    durations.push(cp_sections[i][3]);
  }

  profile_points.push({
    x: now,
    y: temp,
  });

  for (let i = 0; i < size; i++) {
    let currentTime = new Date();
    additional_time += durations[i];
    currentTime.setMinutes(currentTime.getMinutes() + additional_time);
    temp += (durations[i] * ramps[i]) / 60.0;
    profile_points.push({
      x: currentTime,
      y: temp,
    });
  }

  io.emit("profile-data", {
    profile_points: profile_points,
  });
}

function parseBool(on) {
  if (on) {
    return "ON";
  } else {
    return "OFF";
  }
}

function parseMode(mode) {
  if (mode === 0) {
    return "IDLE";
  } else if (mode === 1) {
    return "PROFILE";
  } else if (mode === 2) {
    return "FIXED";
  } else {
    return "MODE ERROR";
  }
}
