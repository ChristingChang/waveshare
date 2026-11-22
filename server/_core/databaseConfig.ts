export function databaseConfig(connectionString: string, databaseSsl?: string) {
  const url = new URL(connectionString);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must be a MySQL connection string");
  const tls = url.hostname.toLowerCase().endsWith(".tidbcloud.com") || databaseSsl === "true";
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: tls ? { minVersion: "TLSv1.2" as const, rejectUnauthorized: true, verifyIdentity: true } : undefined,
  };
}
