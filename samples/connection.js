const socketlink = require("./socketlink-nodejs");

const client = new socketlink({
    clientApiKey: 'sl_d94600b5fefdbc8c03ae63053478ef3a8f338cae4fd6ac3e59bc2fa95d2198e3',
    adminApiKey: 'sl_b4c75523d7c37579df17facea3bdaebd311a2a45ad2fabc2c854e45b934acb62',
    connectionUrl: 'https://adisingh925.socketlink.io',
    uid: "test",
    metadata: "This is test user's metadata"
});

client.onOpen = () => {
    console.log("🎉 Connection is open!");
};

/**
 * 
 * @param {*} msg - message received from users
 * @param {*} rid - The rid for which the message is received
 */
client.onMessage = (msg, rid) => {
    console.log("Message received for rid " + rid + " : ", msg);
};

/**
 * 
 * @param {*} msg - Server warning response after sending a message
 */
client.onWarn = (msg) => {
    console.log(msg);
}

/**
 * 
 * @param {*} err - Server error response due to websocket or server error
 */
client.onError = (err) => {
    console.log(err);
}

/**
 * 
 * @param {*} rid - If you get banned from a room you will get notified here
 */
client.onBanned = (rid) => {
    console.log("you are banned from room " + rid);
}

/**
 * 
 * @param {*} user - notify when a new user joins the state room
 */
client.onUserJoin = (metadata, rid) => {
    console.log("User joined : ", metadata + " to room " + rid);
}

/**
 * 
 * @param {*} user - notify when a user leaves the state room
 */
client.onUserLeave = (metadata, rid) => {
    console.log("User left : ", metadata + " from room " + rid);
}