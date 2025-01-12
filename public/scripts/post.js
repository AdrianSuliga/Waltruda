import { hideWindow } from "./windows.js";

document.getElementById("shutdown_submit").addEventListener("click", () => {
  const enteredPassword = document.getElementById("shutdown_input").value;

  fetch("/shutdown", {
    method: "POST",
    body: JSON.stringify({
      password: enteredPassword,
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  })
    .then((response) => {
      if (response.ok) {
        hideWindow("shutdown_window", ["shutdown_input"]);
      } else {
        response.json().then((data) => {
          alert(data.info);
        });
      }
    })
    .catch((err) => {
      console.log("Error in fetch: ", err);
    });
});

document.getElementById("password_submit").addEventListener("click", () => {
  const enteredOldPassword =
    document.getElementById("old_password_input").value;
  const enteredNewPassword =
    document.getElementById("new_password_input").value;

  if (enteredNewPassword.length < 8) {
    alert("Password should have minimum 8 characters");
    return;
  }

  fetch("/change_password", {
    method: "POST",
    body: JSON.stringify({
      oldPassword: enteredOldPassword,
      newPassword: enteredNewPassword,
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  }).then((response) => {
    response.json().then((data) => {
      alert(data.info);
    });
    if (response.ok) {
      hideWindow("password_window", [
        "old_password_input",
        "new_password_input",
      ]);
    }
  });
});
