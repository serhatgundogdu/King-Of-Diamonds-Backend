const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const moment = require("moment");
const { stat } = require("fs");

const COUNTER_STATING = 5;
const COUNTER_BEGINNING = 10;
const COUNTER_ANSWERS = 30;

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

let users = [];

/* 

Alive Users
{
  id: User Id,
  point: 0
}
Spectators
{
  id: User Id,
}

Dead Users
{
  id: User Id,
}
*/

let playingUsers = [];
let spectators = [];
let deadUsers = [];

/*

{
  id: User Id,
  answer: 2
}

*/
let answers = [];

let counter = 0;

let status = "waiting";

// Steps Should Be : beginning, answers, results, points,  (if someone reach -10 will be dead) repeat till 1 player left
let gameStep = "beginning";

io.on("connection", (socket) => {
  socket.on("login", (userName) => {
    users.push({
      id: socket.id,
      name: userName,
      connectionTime: new moment().format("YYYY-MM-DD HH:mm:ss"),
    });
    if (status == "waiting" || status == "starting") {
      playingUsers.push({
        id: socket.id,
        point: 0,
      });
    }

    if (status == "starting") {
      counter = COUNTER_STATING;
    } else if (status == "waiting") {
    } else {
      spectators.push({
        id: socket.id,
      });
    }

    socket.emit("connecteduser", JSON.stringify(users[users.length - 1]));

    io.emit("users", JSON.stringify(users));
    socket.emit("playingusers", JSON.stringify(playingUsers));
    socket.emit("gamestep", gameStep);
  });

  socket.on("answer", (answer) => {
    answer = JSON.parse(answer);
    if (gameStep == "answers") {
      answers = answers.filter((e) => e.id != socket.id);
      answers.push({
        id: socket.id,
        answer: answer,
      });
    }
  });

  socket.emit("status", status);

  socket.once("disconnect", () => {
    if (status == "starting") {
      counter = COUNTER_STATING;
    }

    if (status == "started") {
      playingUsers = playingUsers.filter((e) => e.id != socket.id);
      deadUsers.push({
        id: socket.id,
      });
    }

    let index = -1;
    if (users.length >= 0) {
      index = users.findIndex((e) => e.id == socket.id);
    }
    playingUsers = playingUsers.filter((e) => e.id != socket.id);
    spectators = spectators.filter((e) => e.id != socket.id);
    if (index >= 0) users.splice(index, 1);
    io.emit("users", JSON.stringify(users));
  });
});

setInterval(() => {
  if (status == "waiting") {
    if (users.length >= 3) {
      counter = COUNTER_STATING;
      status = "starting";
      io.emit("status", status);
    }
  }

  if (status == "starting") {
    counter--;
    if (users.length < 3) {
      status = "waiting";
      io.emit("status", status);
    }
    if (counter == 0) {
      status = "started";
      io.emit("status", status);
      io.emit("playingusers", JSON.stringify(playingUsers));
      counter = COUNTER_BEGINNING;
    }
    io.emit("gamestep", gameStep);

    io.emit("counter", counter);
  }
  if (status == "started") {
    switch (gameStep) {
      case "beginning":
        counter--;
        if (counter == 0) {
          gameStep = "answers";
          counter = COUNTER_ANSWERS;
          io.emit("gamestep", gameStep);
        }
        io.emit("counter", counter);
        answer = [];
        break;
      case "answers":
        counter--;
        if (counter == 0) {
          gameStep = "results";
          io.emit("gamestep", gameStep);
        }
        io.emit("counter", counter);

        break;
      case "results":
        console.log(answers);
        io.emit("answers", JSON.stringify(answers));
        break;
      case "points":
        break;
      default:
        break;
    }
    // counter = COUNTER_WAITING;
  }
}, 1000);

server.listen(5500, () => {
  console.log("listening on *:5500");
});
