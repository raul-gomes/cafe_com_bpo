import { LoginForm } from '../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background decorations for depth */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/30 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
      
      <div className="z-10 w-full mb-8 flex justify-center">
        {/* Placeholder for Logo if we want to import it */}
        <h1 className="text-4xl font-black tracking-tight text-gray-900 bg-clip-text">
          Café com <span className="text-primary">BPO</span>
        </h1>
      </div>
      
      <div className="z-10 w-full">
        <LoginForm />
      </div>
    </div>
  );
}
