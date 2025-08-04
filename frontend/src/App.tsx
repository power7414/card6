import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Google Live API Voice Platform</h1>
          <p className="text-muted-foreground">Voice conversation platform powered by Gemini 2.0 Flash</p>
        </header>
        
        <main className="max-w-4xl mx-auto">
          <div className="card p-6 text-center">
            <h2 className="text-2xl font-semibold mb-4">Development Environment Ready</h2>
            <p className="text-muted-foreground mb-6">
              The frontend development server is running. Start building your voice conversation features!
            </p>
            
            <div className="flex items-center justify-center space-x-4">
              <button
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                onClick={() => setCount((count) => count + 1)}
              >
                Count is {count}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;