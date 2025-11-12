export interface UserMetadata {
  username?: string | null;
}

export interface AuthUser {
  id: string;
  email?: string | null;
  user_metadata: UserMetadata;
  app_metadata: Record<string, unknown>;
}
