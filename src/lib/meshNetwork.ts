import type SimplePeerType from 'simple-peer';
import { offlineStorage, OfflineCourse } from './offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

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

interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
}

class MeshNetwork {
  private peers: Map<string, Peer> = new Map();
  private myId: string;
  private myName: string;
  private sharingEnabled: boolean = true;
  private currentRoomCode: string | null = null;
  private signalingChannel: RealtimeChannel | null = null;
  private userId: string | null = null;
  private pendingConnections: Map<string, SimplePeerType.Instance> = new Map();

  constructor() {
    this.myId = this.generateId();
    this.myName = `Student-${this.myId.slice(0, 6)}`;
    this.initializeUser();
  }

  private async initializeUser() {
    const { data: { user } } = await supabase.auth.getUser();
    this.userId = user?.id || null;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  setSharingEnabled(enabled: boolean) {
    this.sharingEnabled = enabled;
  }

  async getAvailableCourses(): Promise<string[]> {
    const courses = await offlineStorage.getAllCourses();
    return courses.map(c => c.id);
  }

  async createRoom(hostName?: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be authenticated to create room');

    const roomCode = this.generateRoomCode();
    const displayName = hostName || this.myName;

    const { data, error } = await supabase
      .from('mesh_rooms')
      .insert({
        code: roomCode,
        host_id: user.id,
        host_name: displayName
      })
      .select()
      .single();

    if (error) throw error;

    this.currentRoomCode = roomCode;
    this.myName = displayName;
    await this.joinSignalingChannel(roomCode);

    console.log('✅ Room created:', roomCode);
    return roomCode;
  }

  async joinRoom(roomCode: string, peerName?: string): Promise<boolean> {
    // Check if room exists and is active
    const { data: room, error } = await supabase
      .from('mesh_rooms')
      .select('*')
      .eq('code', roomCode)
      .eq('is_active', true)
      .single();

    if (error || !room) {
      console.error('Room not found or inactive');
      return false;
    }

    this.currentRoomCode = roomCode;
    this.myName = peerName || this.myName;
    await this.joinSignalingChannel(roomCode);

    console.log('✅ Joined room:', roomCode);
    return true;
  }

  private async joinSignalingChannel(roomCode: string) {
    if (this.signalingChannel) {
      await supabase.removeChannel(this.signalingChannel);
    }

    this.signalingChannel = supabase
      .channel(`mesh-room-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mesh_signaling',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => this.handleSignalingMessage(payload.new)
      )
      .subscribe((status) => {
        console.log('Signaling channel status:', status);
      });

    // Announce presence to room
    await this.announcePresence(roomCode);
  }

  private async announcePresence(roomCode: string) {
    const courses = await this.getAvailableCourses();
    
    await supabase.from('mesh_signaling').insert({
      room_code: roomCode,
      peer_id: this.myId,
      peer_name: this.myName,
      signal_type: 'ice-candidate',
      signal_data: { 
        type: 'presence',
        courses: courses,
        name: this.myName 
      }
    });
  }

  private async handleSignalingMessage(message: any) {
    // Ignore our own messages
    if (message.peer_id === this.myId) return;

    // Handle targeted messages
    if (message.target_peer_id && message.target_peer_id !== this.myId) return;

    console.log('📡 Received signal:', message.signal_type, 'from', message.peer_name);

    const signalData = message.signal_data;

    if (signalData.type === 'presence') {
      // A new peer announced their presence
      console.log('👋 New peer detected:', message.peer_name, 'with', signalData.courses?.length || 0, 'courses');
      
      // If we don't have a connection to this peer, initiate one
      if (!this.peers.has(message.peer_id) && !this.pendingConnections.has(message.peer_id)) {
        await this.initiateConnection(message.peer_id, message.peer_name, signalData.courses || []);
      }
    } else if (message.signal_type === 'offer') {
      await this.handleOffer(message.peer_id, message.peer_name, signalData, signalData.courses || []);
    } else if (message.signal_type === 'answer') {
      await this.handleAnswer(message.peer_id, signalData);
    } else if (message.signal_type === 'ice-candidate' && signalData.candidate) {
      await this.handleIceCandidate(message.peer_id, signalData);
    }
  }

  private async initiateConnection(peerId: string, peerName: string, courses: string[]) {
    try {
      const SimplePeer = await getSimplePeer();
      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      }) as SimplePeerType.Instance;

      this.pendingConnections.set(peerId, peer);
      this.setupPeerHandlers(peer, peerId, peerName, courses);

      peer.on('signal', async (data) => {
        console.log('📤 Sending offer to', peerName);
        const myCourses = await this.getAvailableCourses();
        
        await supabase.from('mesh_signaling').insert({
          room_code: this.currentRoomCode!,
          peer_id: this.myId,
          peer_name: this.myName,
          target_peer_id: peerId,
          signal_type: 'offer',
          signal_data: { ...data, courses: myCourses }
        });
      });
    } catch (err) {
      console.error('Failed to initiate connection:', err);
      this.pendingConnections.delete(peerId);
    }
  }

  private async handleOffer(peerId: string, peerName: string, signalData: any, courses: string[]) {
    try {
      const SimplePeer = await getSimplePeer();
      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      }) as SimplePeerType.Instance;

      this.pendingConnections.set(peerId, peer);
      this.setupPeerHandlers(peer, peerId, peerName, courses);

      peer.on('signal', async (data) => {
        console.log('📤 Sending answer to', peerName);
        const myCourses = await this.getAvailableCourses();
        
        await supabase.from('mesh_signaling').insert({
          room_code: this.currentRoomCode!,
          peer_id: this.myId,
          peer_name: this.myName,
          target_peer_id: peerId,
          signal_type: 'answer',
          signal_data: { ...data, courses: myCourses }
        });
      });

      peer.signal(signalData);
    } catch (err) {
      console.error('Failed to handle offer:', err);
      this.pendingConnections.delete(peerId);
    }
  }

  private async handleAnswer(peerId: string, signalData: any) {
    const peer = this.pendingConnections.get(peerId);
    if (peer) {
      console.log('📥 Received answer from', peerId);
      peer.signal(signalData);
    }
  }

  private async handleIceCandidate(peerId: string, signalData: any) {
    const peer = this.pendingConnections.get(peerId) || this.peers.get(peerId)?.connection;
    if (peer && signalData.candidate) {
      try {
        peer.signal(signalData);
      } catch (err) {
        console.error('Error handling ICE candidate:', err);
      }
    }
  }

  private setupPeerHandlers(
    peer: SimplePeerType.Instance,
    peerId: string,
    peerName: string,
    courses: string[]
  ) {
    peer.on('connect', () => {
      console.log('🔗 Connected to peer:', peerName);
      
      // Move from pending to active
      this.pendingConnections.delete(peerId);
      this.peers.set(peerId, {
        id: peerId,
        name: peerName,
        connection: peer,
        availableCourses: courses
      });

      // Exchange course lists
      peer.send(JSON.stringify({
        type: 'courses',
        courses: [],
        name: this.myName
      }));
    });

    peer.on('data', async (data) => {
      const message = JSON.parse(data.toString());
      await this.handlePeerMessage(peerId, message, peer);
    });

    peer.on('error', (err) => {
      console.error('❌ Peer error:', peerName, err);
      this.pendingConnections.delete(peerId);
      this.peers.delete(peerId);
    });

    peer.on('close', () => {
      console.log('🔌 Disconnected from peer:', peerName);
      this.pendingConnections.delete(peerId);
      this.peers.delete(peerId);
    });
  }

  async leaveRoom() {
    if (this.signalingChannel) {
      await supabase.removeChannel(this.signalingChannel);
      this.signalingChannel = null;
    }

    // Close all peer connections
    this.disconnectAll();
    
    // If we're the host, deactivate the room
    if (this.currentRoomCode && this.userId) {
      await supabase
        .from('mesh_rooms')
        .update({ is_active: false })
        .eq('code', this.currentRoomCode)
        .eq('host_id', this.userId);
    }

    this.currentRoomCode = null;
    console.log('👋 Left room');
  }

  async discoverPeers(): Promise<string[]> {
    return Array.from(this.peers.keys());
  }

  async connectToPeer(peerId: string, initiator: boolean = false): Promise<boolean> {
    // This method is now handled automatically through the signaling channel
    return true;
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

  getCurrentRoom(): string | null {
    return this.currentRoomCode;
  }

  getMyName(): string {
    return this.myName;
  }

  disconnectAll() {
    this.peers.forEach(peer => {
      peer.connection.destroy();
    });
    this.pendingConnections.forEach(peer => {
      peer.destroy();
    });
    this.peers.clear();
    this.pendingConnections.clear();
  }
}

export const meshNetwork = new MeshNetwork();
