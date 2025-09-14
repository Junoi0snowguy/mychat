const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve main.html
app.get('/', (req, res) => res.sendFile(__dirname + '/main.html'));

// In-memory servers/messages
const servers = {}; // { serverName: [ {user,text,time} ] }

io.on('connection', socket => {
  console.log('User connected', socket.id);

  // Send current server list
  socket.emit('server-list', Object.keys(servers));

  socket.on('join-server', ({ serverName, user }, ack) => {
    serverName = serverName.trim().toLowerCase();
    if (!serverName) return;

    // create server if missing
    if (!servers[serverName]) servers[serverName] = [];

    socket.join(serverName);
    socket.data.user = user;
    socket.data.serverName = serverName;

    // send history
    ack({ history: servers[serverName] });

    // notify server members
    const joinMsg = { system:true, text:`${user} joined ${serverName}`, time:Date.now() };
    servers[serverName].push(joinMsg);
    io.to(serverName).emit('system-message', joinMsg);

    // update server list for all clients
    io.emit('server-list', Object.keys(servers));
  });

  socket.on('chat-message', text => {
    const user = socket.data.user || 'Anon';
    const serverName = socket.data.serverName;
    if (!serverName) return;

    const msg = { user, text, time: Date.now() };
    servers[serverName].push(msg);
    io.to(serverName).emit('chat-message', msg);
  });

  socket.on('disconnect', () => {
    const user = socket.data.user;
    const serverName = socket.data.serverName;
    if (user && serverName) {
      const leaveMsg = { system:true, text:`${user} left ${serverName}`, time:Date.now() };
      servers[serverName].push(leaveMsg);
      io.to(serverName).emit('system-message', leaveMsg);
    }
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
