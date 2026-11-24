export const FRIEND_INVITE_CODE = /^[a-f0-9]{64}$/;

export function friendInvitePath(code: string) {
  return `/invite/${code}`;
}
