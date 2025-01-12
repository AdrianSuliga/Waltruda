document.getElementById("shutdown_button").addEventListener("click", () => {
  showWindow("shutdown_window");
});

document.getElementById("password_button").addEventListener("click", () => {
  showWindow("password_window");
});

document.getElementById("info_button").addEventListener("click", () => {
  showWindow("info_window");
});

document
  .getElementById("close_shutdown_window")
  .addEventListener("click", () => {
    hideWindow("shutdown_window", ["shutdown_input"]);
  });

document
  .getElementById("close_passchange_window")
  .addEventListener("click", () => {
    hideWindow("password_window", ["old_password_input", "new_password_input"]);
  });

document.getElementById("close_info_window").addEventListener("click", () => {
  hideWindow("info_window");
});

function showWindow(windowID) {
  const slidingWindow = document.getElementById(windowID);
  slidingWindow.style.display = "block";
  disableButtons();
  setTimeout(() => {
    slidingWindow.style.top = "50%";
  });
}

export function hideWindow(windowID, inputsID = []) {
  inputsID.forEach((inputID) => {
    document.getElementById(inputID).value = "";
  });
  const slidingWindow = document.getElementById(windowID);
  slidingWindow.style.top = "125%";
  slidingWindow.style.display = "none";
  enableButtons();
}

function disableButtons() {
  document.getElementById("shutdown_button").disabled = true;
  document.getElementById("password_button").disabled = true;
  document.getElementById("info_button").disabled = true;
}

function enableButtons() {
  document.getElementById("shutdown_button").disabled = false;
  document.getElementById("password_button").disabled = false;
  document.getElementById("info_button").disabled = false;
}
