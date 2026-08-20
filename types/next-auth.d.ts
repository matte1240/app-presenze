import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      hasPermesso104: boolean;
      hasPaternityLeave: boolean;
    };
  }

  interface User {
    id: string;
    role: string;
    image?: string | null;
    hasPermesso104: boolean;
    hasPaternityLeave: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    picture?: string | null;
    hasPermesso104?: boolean;
    hasPaternityLeave?: boolean;
  }
}
