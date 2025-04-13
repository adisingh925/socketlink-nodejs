const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

class socketlink {
    constructor({
        clientApiKey,
        adminApiKey,
        connectionUrl,
        uid,
        autoReconnect = true,
        reconnectInterval = 3000,
        rejectUnauthorized = true
    }) {
        this.clientApiKey = clientApiKey;
        this.adminApiKey = adminApiKey;
        this.connectionUrl = connectionUrl;
        this.uid = uid || uuidv4();

        this.autoReconnect = autoReconnect;
        this.reconnectInterval = reconnectInterval;
        this.rejectUnauthorized = rejectUnauthorized;

        this.ws = null;
        this.reconnectTimer = null;

        this.api = {
            GET_METRICS: "/api/v1/metrics",
            MYSQL_SYNC: "/api/v1/mysql/sync",
            FETCH_ALL_ROOMS: "/api/v1/rooms/users/all",
            GET_ORPHAN_USERS: "/api/v1/users/orphan",
            GET_USERS_IN_ROOM: "/api/v1/rooms/users",
            SUBSCRIBE_TO_ROOM: "/api/v1/users/subscribe/room",
            GET_ALL_SUBSCRIPTIONS: "/api/v1/users/subscriptions/all",
            GET_SUBSCRIPTIONS: "/api/v1/users/subscriptions",
            UNSUBSCRIBE_FROM_ROOM: "/api/v1/users/unsubscribe/room",
            BROADCAST_TO_EVERYONE: "/api/v1/broadcast",
            BROADCAST_IN_ROOMS: "/api/v1/rooms/broadcast",
            BROADCAST_TO_USERS: "/api/v1/users/broadcast",
            BAN_USERS: "/api/v1/rooms/users/ban",
            UNBAN_USERS: "/api/v1/rooms/users/unban",
            ENABLE_DISABLE_MESSAGING_IN_SERVER: "/api/v1/server/messaging/:action",
            ENABLE_DISABLE_MESSAGING_IN_ROOM: "/api/v1/rooms/messaging/:action",
            GET_BANNED_USERS: "/api/v1/users/banned",
            GET_MESSAGING_DISABLED_USERS: "/api/v1/users/messaging/disabled",
            GET_MESSAGE_FOR_ROOM: "/api/v1/messages/room/:rid",
            DELETE_LOCAL_DATABASE: "/api/v1/database",
            PING_SERVER: "/api/v1/ping"
        };

        this.connect(); /** auto connect on initialize */
    }

    checkclientapiKey() {
        if (this.clientApiKey === undefined || this.clientApiKey === null || this.clientApiKey === "") {
            throw new Error("clientApiKey is required");
        }
    }

    checkAdminApiKey() {
        if (this.adminApiKey === undefined || this.adminApiKey === null || this.adminApiKey === "") {
            throw new Error("adminApiKey is required");
        }
    }

    connect() {
        this.checkclientapiKey();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        this.ws = new WebSocket(this.convertHttpsToWss(this.connectionUrl), {
            headers: {
                'api-key': this.clientApiKey,
                'uid': this.uid
            },
            rejectUnauthorized: this.rejectUnauthorized,
        });

        this.ws.on('open', () => {
            if (this.onOpen) this.onOpen();
        });

        this.ws.on('message', (data) => {
            const msg = data.toString();
            const parsedMsg = JSON.parse(msg);

            const source = parsedMsg.source;

            if (source === "user") {
                if (this.onMessage) this.onMessage(parsedMsg.data, parsedMsg.rid);
            } else if (source === "server") {
                if (this.onServerBroadcast) this.onServerBroadcast(parsedMsg.data);
            } else if (source === "admin") {
                if (this.onAdminBroadcast) this.onAdminBroadcast(parsedMsg.data, parsedMsg.rid);
            }
        });

        this.ws.on('close', () => {
            if (this.onClose) this.onClose();

            if (this.autoReconnect) {
                this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectInterval);
            }
        });

        this.ws.on('error', (err) => {
            console.error(err);
            if (this.onError) this.onError(err);
        });

    }

    send(message, rid) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                message: message,
                rid: rid,
                timestamp: Date.now(),
            }));
        } else {
            console.warn("⚠️ Cannot send message, socket not open!");
        }
    }

    close() {
        this.autoReconnect = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) this.ws.close();
    }

    convertHttpsToWss(httpsUrl) {
        const url = new URL(httpsUrl);
        if (url.protocol !== 'https:') {
            throw new Error('Provided URL is not HTTPS');
        }

        url.protocol = 'wss:';
        return url.toString();
    }

    /** common api call function */
    async makeRequest({ url, method = 'GET', params = {}, headers = {}, data = {} }) {
        try {
            const response = await axios({ url, method, params, headers, data });
            return response.data;
        } catch (err) {
            const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
            throw new Error(`API Request Error : ${msg}`);
        }
    }

    async getUsageMetrics() {
        this.checkAdminApiKey();

        const url = new URL(this.api.GET_METRICS, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: { "api-key": this.adminApiKey },
        });
    }

    async syncMySQL() {
        this.checkAdminApiKey();

        const url = new URL(this.api.MYSQL_SYNC, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: { "api-key": this.adminApiKey },
        })
    }

    async fetchAllRooms() {
        this.checkAdminApiKey();

        const url = new URL(this.api.FETCH_ALL_ROOMS, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: { "api-key": this.adminApiKey },
        })
    }

    async getOrphanUsers() {
        this.checkAdminApiKey();

        const url = new URL(this.api.GET_ORPHAN_USERS, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: { "api-key": this.adminApiKey },
        })
    }

    async getAllUsersInGivenRooms(rids) {
        this.checkAdminApiKey();

        if (!rids) {
            throw new Error("rids is required");
        }

        if (Array.isArray(rids)) {
            if (rids.length === 0) {
                throw new Error("rids array cannot be empty");
            }
        } else {
            throw new Error("rids must be an array of strings");
        }

        const url = new URL(this.api.GET_USERS_IN_ROOM, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: { rid: rids }
        });
    }

    async subscribeToRoom(rid) {
        this.checkclientapiKey();

        if (!rid || typeof rid !== "string") {
            throw new Error("Invalid rid: must be a non-empty string");
        }

        const pathWithRoomId = `${this.api.SUBSCRIBE_TO_ROOM}/${encodeURIComponent(rid)}`;
        const url = new URL(pathWithRoomId, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: {
                "api-key": this.clientApiKey,
                "uid": this.uid,
            },
        });
    }

    async getSubscriptionsForAllUsers() {
        this.checkAdminApiKey();

        const url = new URL(this.api.GET_ALL_SUBSCRIPTIONS, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: { "api-key": this.adminApiKey },
        })
    }

    async getSubscriptionsForGivenUsers(uids) {
        this.checkAdminApiKey();

        if (!uids) {
            throw new Error("uids is required");
        }

        if (Array.isArray(uids)) {
            if (uids.length === 0) {
                throw new Error("uids array cannot be empty");
            }
        } else {
            throw new Error("uids must be an array of strings");
        }

        const url = new URL(this.api.GET_SUBSCRIPTIONS, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: { uid: uids }
        });
    }

    async unsubscribeFromRoom(rid) {
        this.checkclientapiKey();

        if (!rid || typeof rid !== 'string') {
            throw new Error("rid must be a non-empty string");
        }

        const pathWithRoomId = `${this.api.UNSUBSCRIBE_FROM_ROOM}/${encodeURIComponent(rid)}`;
        const url = new URL(pathWithRoomId, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: {
                "api-key": this.clientApiKey,
                "uid": this.uid,
            },
        });
    }

    async broadcastMessageToEveryone(message) {
        this.checkAdminApiKey();

        if (!message || typeof message !== 'string') {
            throw new Error("Message must be a non-empty string");
        }

        const url = new URL(this.api.BROADCAST_TO_EVERYONE, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: { message }
        });
    }

    async broadcastMessageToGivenRooms(message, rids) {
        this.checkAdminApiKey();

        if (!message || typeof message !== 'string') {
            throw new Error("Message must be a non-empty string");
        }

        if (!rids) {
            throw new Error("Room IDs (rids) are required");
        }

        if (Array.isArray(rids)) {
            if (rids.length === 0) {
                throw new Error("Room IDs array cannot be empty");
            }
        } else {
            throw new Error("rids must be an array of strings");
        }

        const url = new URL(this.api.BROADCAST_IN_ROOMS, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: { message, rid: rids }
        });
    }

    async broadcastMessageToGivenUsers(message, uids) {
        this.checkAdminApiKey();

        if (!message || typeof message !== 'string') {
            throw new Error("Message must be a non-empty string");
        }

        if (!uids) {
            throw new Error("User IDs (uids) are required");
        }

        if (Array.isArray(uids)) {
            if (uids.length === 0) {
                throw new Error("User IDs array cannot be empty");
            }
        } else {
            throw new Error("uids must be an array of strings");
        }

        const url = new URL(this.api.BROADCAST_TO_USERS, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: { message, uid: uids }
        });
    }

    async banUsersInGivenRooms(rid, uids) {
        this.checkAdminApiKey();

        if (!rid || typeof rid !== 'string') {
            throw new Error("rid must be a non-empty string");
        }

        if (!uids) {
            throw new Error("uids are required");
        }

        if (Array.isArray(uids)) {
            if (uids.length === 0) {
                throw new Error("uids array cannot be empty");
            }
        } else {
            throw new Error("uids must be an array of strings");
        }

        const url = new URL(this.api.BAN_USERS, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: [
                {
                    rid: rid,       // e.g., 'pub-state-cache-test-0'
                    uid: uids       // e.g., ['test']
                }
            ]
        });
    }

    async banUsersFromTheServer(uids) {
        this.checkAdminApiKey();

        if (!uids) {
            throw new Error("uids are required");
        }

        if (Array.isArray(uids)) {
            if (uids.length === 0) {
                throw new Error("uids array cannot be empty");
            }
        } else {
            throw new Error("uids must be a string or an array of strings");
        }

        const url = new URL(this.api.BAN_USERS, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: [
                {
                    rid: "global",       // e.g., 'pub-state-cache-test-0'
                    uid: uids       // e.g., ['test']
                }
            ]
        });
    }

    async unbanUsersFromGivenRooms(rid, uids) {
        this.checkAdminApiKey();

        if (!rid || typeof rid !== 'string') {
            throw new Error("rid must be a non-empty string");
        }

        if (!uids) {
            throw new Error("uids are required");
        }

        if (Array.isArray(uids)) {
            if (uids.length === 0) {
                throw new Error("uids array cannot be empty");
            }
        } else {
            throw new Error("uids must be a string or an array of strings");
        }

        const url = new URL(this.api.UNBAN_USERS, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: [
                {
                    rid: rid,       // e.g., 'pub-state-cache-test-0'
                    uid: uids       // e.g., ['test']
                }
            ]
        });
    }

    async unbanUsersFromTheServer(uids) {
        this.checkAdminApiKey();

        if (!uids) {
            throw new Error("uids are required");
        }

        if (Array.isArray(uids)) {
            if (uids.length === 0) {
                throw new Error("uids array cannot be empty");
            }
        } else {
            throw new Error("uids must be a string or an array of strings");
        }

        const url = new URL(this.api.UNBAN_USERS, this.connectionUrl);

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data: [
                {
                    rid: "global",       // e.g., 'pub-state-cache-test-0'
                    uid: uids       // e.g., ['test']
                }
            ]
        });
    }

    async enableDisableMessagingInServer(action) {
        this.checkAdminApiKey();

        const allowedActions = ['enable', 'disable'];

        if (!allowedActions.includes(action)) {
            throw new Error(`Invalid action "${action}". Allowed actions are : ${allowedActions.join(', ')}`);
        }

        const url = new URL(
            this.api.ENABLE_DISABLE_MESSAGING_IN_SERVER.replace(':action', action),
            this.connectionUrl
        );

        return this.makeRequest({
            url: url.toString(),
            method: 'PUT',
            headers: {
                "api-key": this.adminApiKey
            },
        });
    }

    async enableDisableMessagingGloballyForGivenUsers(action, uids) {
        this.checkAdminApiKey();

        const allowedActions = ['enable', 'disable'];

        if (!allowedActions.includes(action)) {
            throw new Error(`Invalid action "${action}". Allowed actions are : ${allowedActions.join(', ')}`);
        }

        if (!uids) {
            throw new Error("'uids' (string array) are required.");
        }

        if (Array.isArray(uids)) {
            if (uids.length === 0) {
                throw new Error("uids array cannot be empty");
            }
        } else {
            throw new Error("uids must be an array of strings");
        }

        const url = new URL(this.api.ENABLE_DISABLE_MESSAGING_IN_ROOM.replace(':action', action), this.connectionUrl);

        const data = [
            {
                rid: "global",
                uid: uids
            }
        ];

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data
        });
    }

    async enableDisableMessagingInRoomsForGivenUsers(action, rid, uids) {
        this.checkAdminApiKey();

        const allowedActions = ['enable', 'disable'];

        if (!allowedActions.includes(action)) {
            throw new Error(`Invalid action "${action}". Allowed actions are : ${allowedActions.join(', ')}`);
        }

        if (!rid || !uids) {
            throw new Error("'rid' (string) and 'uids' (string array) are required.");
        }

        if (Array.isArray(uids)) {
            if (uids.length === 0) {
                throw new Error("uids array cannot be empty");
            }
        } else {
            throw new Error("uids must be an array of strings");
        }

        const url = new URL(this.api.ENABLE_DISABLE_MESSAGING_IN_ROOM.replace(':action', action), this.connectionUrl);

        const data = [
            {
                rid,
                uid: uids
            }
        ];

        return this.makeRequest({
            url: url.toString(),
            method: 'POST',
            headers: { "api-key": this.adminApiKey },
            data
        });
    }

    async getBannedUsers() {
        this.checkAdminApiKey();

        const url = new URL(this.api.GET_BANNED_USERS, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: { "api-key": this.adminApiKey },
        })
    }

    async getUsersWithMessagingDisabled() {
        this.checkAdminApiKey();

        const url = new URL(this.api.GET_MESSAGING_DISABLED_USERS, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: { "api-key": this.adminApiKey },
        })
    }

    async getMessageForCacheRoom(rid, uid) {
        this.checkclientapiKey();

        if (!rid || typeof rid !== 'string') {
            throw new Error("'rid' is required and must be a string.");
        }

        if (!uid || typeof uid !== 'string') {
            throw new Error("'uid' is required and must be a string.");
        }

        const url = new URL(
            this.api.GET_MESSAGE_FOR_ROOM.replace(':rid', encodeURIComponent(rid)),
            this.connectionUrl
        );

        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
            headers: {
                "api-key": this.clientApiKey,
                uid: this.uid
            }
        });
    }

    async deleteLocalDatabase() {
        this.checkAdminApiKey();

        const url = new URL(this.api.DELETE_LOCAL_DATABASE, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'DELETE',
            headers: { "api-key": this.adminApiKey },
        })
    }

    async pingTheServer() {
        const url = new URL(this.api.PING_SERVER, this.connectionUrl);
        return this.makeRequest({
            url: url.toString(),
            method: 'GET',
        })
    }
}


module.exports = socketlink;