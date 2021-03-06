var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    $ = require('./utility'),
    HubConnection = require('./hubs').HubConnection,
    serverSentEvents = require('./transports/serverSentEvents').ServerSentEvents,
    Deferred = require('Deferred');

(function(exports) {

  var generateClientMessage = function(message) {
    return {
      id: $.newId(),
      content: message
    };
  }

  var getMessageViewModel = function(chat, message) {
    var re = new RegExp("\\b@?" + chat.state.name.replace(/\./, '\\.') + "\\b", "i");
    return {
      User: message.User,
      Content: message.Content,
      Id: message.Id,
      When: message.When.fromJsonDate(),
      IsOwn: re.test(message.User.name)
    };
  };

  var JabbrClientEvents = {
    onMessageReceived: "messageReceived",
    onChangeNote: "changeNote"
  };

  exports.JabbrClientEvents = JabbrClientEvents;
  
  exports.JabbrClient = function(url) {
    var self = this;
    this.url = url;
    this.hub = new HubConnection(url);
    this.clientTransport = serverSentEvents;
    this.chat = this.hub.createProxy("chat");
    this.chat.client = {
      addMessage: function(message, room) {
        self.emit(JabbrClientEvents.onMessageReceived, getMessageViewModel(self.chat, message), room);
      },
      changeNote: function(user, room) {
        self.emit(JabbrClientEvents.onChangeNote, user, room);
      }
    };
    // server commands we can execute
    this.chat.server = {
      checkStatus: function() {
        return self.chat.invoke.apply(self.chat, $.merge(["CheckStatus"], $.makeArray(arguments)));
      },
      join: function() {
        return self.chat.invoke.apply(self.chat, $.merge(["Join"], $.makeArray(arguments)))
      },
      send: function() {
        return self.chat.invoke.apply(self.chat, $.merge(["Send"], $.makeArray(arguments)));
      }
    };
    this.hub.createHubProxies();
  };

  util.inherits(exports.JabbrClient, EventEmitter);

  exports.JabbrClient.prototype.connect = function(username, password, onSuccess) {
    var self = this,
        options = {
          transport: self.clientTransport
        };
    
    this.hub.start(options, function() {
      self.chat.server.join()
          .fail(function(e) {
            console.log("Failed to join hub: " + e);
          })
          .done(function(success) {
            self.hub.log("Joined hub!");
            if (success === false) {
              self.setNick(username, password)
                .fail(function(e) {
                  console.log("Failed to set nick " + e);
                })
                .done(function(success) {
                  if (onSuccess) {
                    onSuccess(success);
                  }
                });
            }
          });
    });
  };

  /**
   * Joins a room. This room has to exist first
   *
   * @param room The room to join
   * @param onSuccess Optional callback to execute if successful
   */
  exports.JabbrClient.prototype.joinRoom = function(roomName, onSuccess) {
    var self = this,
        clientMessage = {
          id: $.newId(),
          content: "/join " + roomName,
          room: self.chat.state.activeRoom
        };
    this.chat.server.send(clientMessage)
      .fail(function(e) {
        self.hub.log("Failed to join room: " + e);
      })
      .done(function(success) {
        self.hub.log("Joined " + roomName);
        if (onSuccess) {
          onSuccess();
        }
      });
  };

  /**
   * Set the nick. If a nick exists and the password is correct,
   * the nick of the client will be changed. If the nick doesn't
   * exist then it will automatically be associated with the password
   * by the server.
   *
   * @param username The username to set
   * @param password The password to use
   */
  exports.JabbrClient.prototype.setNick = function(username, password) {
    var clientMessage = generateClientMessage("/nick " + username + " " + password);
    return this.chat.server.send(clientMessage);
  };

  /**
   * Show a small flag which represents your nationality.
   *
   * @param isoCountry Iso 3366-2 Code (ISO Reference Chart: http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)
   */
  exports.JabbrClient.prototype.setFlag = function(isoCountry) {
    var clientMessage = generateClientMessage("/flag " + isoCountry);
    return this.chat.server.send(clientMessage);
  };

  /**
   * Send a message to a room
   *
   * @param msg The message to send
   * @param room The room to send the message to
   */
  exports.JabbrClient.prototype.say = function(msg, room) {
    var clientMessage = generateClientMessage(msg);
    clientMessage.room = room;
    return this.chat.server.send(clientMessage);
  };

  /**
   * Sets the gravatar
   *
   * @param email The email address to use for the gravatar
   */
  exports.JabbrClient.prototype.setGravatar = function(email) {
    var clientMessage = generateClientMessage("/gravatar " + email);
    return this.chat.server.send(clientMessage);
  };

  /**
   * Sets a note that others can see
   *
   * @param note The note to set
   */
  exports.JabbrClient.prototype.setNote = function(note) {
    var clientMessage = generateClientMessage("/note " + note);
    return this.chat.server.send(clientMessage);
  };

  /**
   * Leaves a room
   *
   * @param room The room to leave
   * @param callback An optional callback when leaving the room is successful
   */
  exports.JabbrClient.prototype.leaveRoom = function(room, callback) {
    var clientMessage = generateClientMessage("/leave " + room);
    clientMessage.room = room;
    this.chat.server.send(clientMessage).then(function() {
      if (callback) {
        callback();
      }
    });

    exports.JabbrClient.prototype.disconnect = function() {
      this.hub.stop();
    };
  };

})(module.exports)
