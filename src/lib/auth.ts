import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // ส่งข้อมูลผู้เล่นไปยัง Client-side เพื่อให้ GameHeader แสดงชื่อได้
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/lobby', // ถ้ายังไม่ได้ login ให้เด้งกลับมาหน้า Lobby
  },
};