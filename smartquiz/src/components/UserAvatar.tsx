import { initials } from '../lib/format';

interface UserAvatarProps {
  name: string;
  avatar?: string | null;
  className?: string;
}

export function UserAvatar({ name, avatar, className }: UserAvatarProps) {
  return (
    <span className={`account-avatar${className ? ` ${className}` : ''}`} aria-hidden="true">
      {avatar ? <img src={avatar} alt="" /> : initials(name)}
    </span>
  );
}
