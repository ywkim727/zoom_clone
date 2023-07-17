import http from "http";
import SocketIO from "socket.io";
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);


wsServer.on("connection", (socket) => {
    socket.on("join_room", (roomName) => {
        socket.join(roomName); // roomName에 해당하는 room에 join
        socket.to(roomName).emit("welcome"); // roomName에 해당하는 room에 welcome event를 emit
    });
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer); // roomName에 해당하는 room에 offer event를 emit
    });
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer); // roomName에 해당하는 room에 answer event를 emit
    });
    socket.on("ice", (ice, roomName) => {
        socket.to(roomName).emit("ice", ice); // roomName에 해당하는 room에 ice event를 emit
    });
});

const handleListen = () => console.log("Listening on http://localhost:3000");
httpServer.listen(3000, handleListen);

