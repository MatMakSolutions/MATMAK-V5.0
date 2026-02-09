/*const { exec } = require('child_process');
exec('wmic printer list brief', (err, stdout, stderr) => {
  if (err) {
    // node couldn't execute the command
    return;
  }
  // list of printers with brief details
  console.log(stdout);
  // the *entire* stdout and stderr (buffered)
  stdout = stdout.split("  ");
  var printers = [];
  j = 0;
  stdout = stdout.filter(item => item);
  for (i = 0; i < stdout.length; i++) {
    if (stdout[i] == " \r\r\n" || stdout[i] == "\r\r\n") {
      printers[j] = stdout[i + 1];
      j++;
    }
  }
  // list of only printers name
  console.log(printers);
  console.log(stderr);
});*/


//Roland GR-640


const path = require("path");
const net = require("net");
const fs = require("fs");

const port = 1234;
let dataStr = "";


const server = net.createServer((socket) => {
  console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on('data', (data) => {
    console.log(`Received data from client: ${data.toString()}`);

    // generate random guid name for file
    dataStr += data.toString();
  });

  socket.on('end', () => {
    console.log('Client disconnected');
    var guid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    var fileName = guid + ".hpgl";
    var filePath = path.join(__dirname, "hpgl", fileName);

    fs.writeFile(filePath, dataStr.toString(), function (err) {
      if (err) {
        return console.log(err);
      }
      console.log("The file was saved!");
      dataStr = "";
    });
  });

  socket.on('error', (err) => {
    console.error(`Error with client connection: ${err}`);
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});