import type SimplePeerType from 'simple-peer';
import { offlineStorage, OfflineCourse } from './offlineStorage';

let SimplePeerCtor: any | null = null;
async function getSimplePeer() {
  if (!SimplePeerCtor) {
    const mod = await import('simple-peer');
    SimplePeerCtor = mod.default;
  }
  return SimplePeerCtor;
}

interface Peer {
  id: string;
  name: string;
  connection: SimplePeerType.Instance;
  availableCourses: string[];
}

class MeshNetwork {
  private peers: Map<string, Peer> = new Map();
  private myId: string;
  private myName: string;
  private sharingEnabled: boolean = true;

  constructor() {
    this.myId = this.generateId();
    this.myName = `Student-${this.myId.slice(0, 6)}`;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  setSharingEnabled(enabled: boolean) {
    this.sharingEnabled = enabled;
  }

  async getAvailableCourses(): Promise<string[]> {
    const courses = await offlineStorage.getAllCourses();
    return courses.map(c => c.id);
  }

  async discoverPeers(): Promise<string[]> {
    // In a real implementation, this would use WebRTC signaling
    // For now, we'll simulate peer discovery
    console.log('Discovering peers via mesh network...');
    return Array.from(this.peers.keys());
  }

  async connectToPeer(peerId: string, initiator: boolean = false): Promise<boolean> {
    try {
      const SimplePeer = await getSimplePeer();
      const peer = new SimplePeer({
        initiator,
        trickle: false,
      }) as SimplePeerType.Instance;

      peer.on('signal', (data) => {
        console.log('Signal data:', data);
        // In production, send this to signaling server
      });

      peer.on('connect', async () => {
        console.log(`Connected to peer ${peerId}`);
        
        // Exchange available courses
        const myCourses = await this.getAvailableCourses();
        peer.send(JSON.stringify({
          type: 'courses',
          courses: myCourses,
          name: this.myName
        }));
      });

      peer.on('data', async (data) => {
        const message = JSON.parse(data.toString());
        await this.handlePeerMessage(peerId, message, peer);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        this.peers.delete(peerId);
      });

      peer.on('close', () => {
        console.log(`Disconnected from peer ${peerId}`);
        this.peers.delete(peerId);
      });

      return true;
    } catch (err) {
      console.error('Failed to connect to peer:', err);
      return false;
    }
  }

  private async handlePeerMessage(peerId: string, message: any, connection: SimplePeerType.Instance) {
    switch (message.type) {
      case 'courses':
        this.peers.set(peerId, {
          id: peerId,
          name: message.name,
          connection,
          availableCourses: message.courses
        });
        console.log(`Peer ${message.name} has ${message.courses.length} courses`);
        break;

      case 'request_course':
        if (this.sharingEnabled) {
          await this.sendCourse(peerId, message.courseId);
        }
        break;

      case 'course_data':
        await this.receiveCourse(message.course);
        break;
    }
  }

  async requestCourse(peerId: string, courseId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.error('Peer not found');
      return false;
    }

    peer.connection.send(JSON.stringify({
      type: 'request_course',
      courseId
    }));

    return true;
  }

  private async sendCourse(peerId: string, courseId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const course = await offlineStorage.getCourse(courseId);
    if (!course) {
      console.error('Course not found locally');
      return;
    }

    peer.connection.send(JSON.stringify({
      type: 'course_data',
      course
    }));

    console.log(`Sent course ${courseId} to peer ${peerId}`);
  }

  private async receiveCourse(course: OfflineCourse) {
    await offlineStorage.saveCourse(course);
    console.log(`Received and saved course ${course.id}`);
  }

  getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  disconnectAll() {
    this.peers.forEach(peer => {
      peer.connection.destroy();
    });
    this.peers.clear();
  }
}

export const meshNetwork = new MeshNetwork();
