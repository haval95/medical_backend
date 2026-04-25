import app from './app';

const PORT = 3001;
const HOST = '0.0.0.0';

app
  .listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(
      `📡 Network accessible - find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)`
    );
  })
  .on('error', (err: Error) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
