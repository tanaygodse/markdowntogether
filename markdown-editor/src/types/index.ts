export interface Document {
  id: string;
  roomCode: string;
  title: string;
  content: string;
  lastModified: Date;
  version: number;
}

export interface EditorState {
  content: string;
  isPreviewMode: boolean;
  splitView: boolean;
  cursorPosition: number;
}

export interface ToolbarAction {
  type: 'bold' | 'italic' | 'strikethrough' | 'code' | 'link' | 'image' | 'heading' | 'list-ordered' | 'list-unordered';
  value?: string;
}

export interface User {
  id: string;
  name: string;
  color: string;
  joinedAt: Date;
}

export interface CursorPosition {
  userId: string;
  position: number;
  line: number;
  column: number;
}

export interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: Date;
  version: number;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  userId?: string;
}

// Message types
export const MessageTypes = {
  JOIN: 'join',
  LEAVE: 'leave',
  DOCUMENT_UPDATE: 'document_update',
  TITLE_UPDATE: 'title_update',
  OPERATION: 'operation',
  CURSOR: 'cursor',
  USER_LIST: 'user_list',
  DOCUMENT_SYNC: 'document_sync',
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  ERROR: 'error',
} as const;

// Payloads
export interface JoinPayload {
  user: User;
  documentId: string;
}

export interface LeavePayload {
  userId: string;
}

export interface DocumentUpdatePayload {
  document: Document;
}

export interface OperationPayload {
  operation: Operation;
  documentId: string;
}

export interface CursorPayload {
  position: CursorPosition;
  documentId: string;
}

export interface UserListPayload {
  users: User[];
}

export interface DocumentSyncPayload {
  document: Document;
  users: User[];
}

export interface TitleUpdatePayload {
  documentId: string;
  newTitle: string;
}

export interface CreateRoomPayload {
  user: User;
  title: string;
  content: string;
}

export interface CreateRoomResponse {
  document: Document;
  roomCode: string;
}

export interface JoinRoomPayload {
  user: User;
  roomCode: string;
}

export interface ErrorPayload {
  message: string;
  code: string;
}