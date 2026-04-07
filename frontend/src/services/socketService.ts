import { io, Socket } from 'socket.io-client';

class SocketService {
  public socket: Socket | null = null;
  private url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

  public connect(token?: string) {
    if (this.socket) return;
    
    this.socket = io(this.url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
