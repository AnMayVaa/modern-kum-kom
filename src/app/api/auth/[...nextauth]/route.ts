import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // 💡 เพิ่ม secret ตรงนี้ด้วยเพื่อความชัวร์ (อ่านจาก env)
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // ปรับแต่ง session ได้ถ้าต้องการ (เช่น อยากได้ ID จาก Google)
    async session({ session, token }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };