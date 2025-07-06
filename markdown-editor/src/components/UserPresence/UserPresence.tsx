import React from 'react';
import type { User, CursorPosition } from '../../types';
import './UserPresence.css';

interface UserPresenceProps {
  users: User[];
  cursors: CursorPosition[];
  currentUserId?: string;
  isConnected: boolean;
}

const UserPresence: React.FC<UserPresenceProps> = ({ 
  users, 
  currentUserId, 
  isConnected 
}) => {
  console.log(users);
  const otherUsers = users.filter(user => user.id !== currentUserId);

  return (
    <div className="user-presence">
      <div className="connection-status">
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
        <span className="status-text">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      {otherUsers.length > 0 && (
        <div className="active-users">
          <span className="users-label">Active users:</span>
          <div className="user-avatars">
            {otherUsers.map(user => (
              <UserAvatar key={user.id} user={user} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface UserAvatarProps {
  user: User;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user }) => {
  const initials = user.name
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div 
      className="user-avatar" 
      style={{ backgroundColor: user.color }}
      title={user.name}
    >
      {initials}
    </div>
  );
};

export default UserPresence;