const ctx = document.getElementById("waltruda_chart");
let socket = io();

const waltrudaChart = new Chart(ctx, {
  type: "line",
  data: {
    datasets: [
      {
        label: "Average temperature",
        data: [],
        pointRadius: 1,
        backgroundColor: "rgb(190, 30, 30)",
        borderColor: "rgb(190, 30, 30)",
      },
      {
        label: "Desired profile temperature",
        data: [],
        pointRadius: 1,
        backgroundColor: "rgb(60, 190, 30)",
        borderColor: "rgb(60, 190, 30",
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: "black",
        },
        title: {
          display: true,
          text: "Temperature (°C)",
          font: {
            size: "30px",
          },
        },
      },
      x: {
        type: "time",
        time: {
          unit: "minute",
          tooltipFormat: "yyyy-MM-dd HH:mm:ss",
          displayFormats: {
            minute: "HH:mm",
            hour: "HH:mm",
            day: "yyyy-MM-dd",
          },
        },
        ticks: {
          color: "black",
        },
        title: {
          display: true,
          text: "Time",
          font: {
            size: "30px",
          },
        },
      },
    },
  },
});

socket.on("mqtt-data", (data) => {
  let avg = 0;
  for (let i = 1; i <= 4; i++) {
    let id = "temp" + i;
    document.getElementById(id).textContent = data.temps[i - 1];
    avg += parseFloat(data.temps[i - 1]);
  }
  avg = parseFloat((avg / 4).toFixed(2));
  if (isNaN(avg)) {
    avg = "-";
  } else {
    avg = avg + " °C";
  }
  document.getElementById("avg_temp").textContent = avg;
  document.getElementById("duty_cycle").textContent = data.duty_cycle;
  document.getElementById("desired_temp").textContent = data.desired_temp;
  document.getElementById("progress_min").textContent = data.progress_min;
  document.getElementById("fan_info").textContent = data.fan_on;
  document.getElementById("pump_info").textContent = data.vacuum_on;
  document.getElementById("heater_mode").textContent = data.mode;
  waltrudaChart.data.datasets[0].data = data.chart_points;
  waltrudaChart.update();
});

socket.on("profile-data", (data) => {
  waltrudaChart.data.datasets[1].data = data.profile_points;
  waltrudaChart.update();
});

socket.on("connection-data", (data) => {
  document.getElementById("conn_status").textContent = data.status;
});
