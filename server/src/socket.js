let ioInstance = null;

function initSocket(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    socket.on('join:restaurant', (restaurantId) => {
      if (restaurantId) socket.join('restaurant:' + restaurantId);
    });
    socket.on('join:admin', () => {
      socket.join('admin');
    });
  });
}

function emitToRestaurant(restaurantId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to('restaurant:' + String(restaurantId)).emit(event, payload);
}

function emitToAllRestaurants(event, payload) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
}

function emitToAdmin(event, payload) {
  if (!ioInstance) return;
  ioInstance.to('admin').emit(event, payload);
}

module.exports = { initSocket, emitToRestaurant, emitToAllRestaurants, emitToAdmin };
