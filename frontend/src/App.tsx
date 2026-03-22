import {
  Button,
  Flex,
  Heading,
  ProgressCircle,
  Text,
  View,
} from "@adobe/react-spectrum";
import { useEffect, useRef, useState } from "react";
import { IDisposable, Terminal as XtermTerminal } from "xterm";
import { api } from "./lib/api";
import { ApiToken, CommandLog, Principal, Role } from "./types";
import { LoginPanel } from "./components/LoginPanel";
import { SessionBar } from "./components/SessionBar";
import { PasswordPanel } from "./components/PasswordPanel";
import { AtCommandsPanel } from "./components/AtCommandsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { TokensPanel } from "./components/TokensPanel";
import { TerminalPanel } from "./components/TerminalPanel";

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem("jwt") ?? "");
  const [user, setUser] = useState<Principal | null>(null);
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [atCommand, setAtCommand] = useState("AT+CSQ");
  const [atTimeout, setAtTimeout] = useState("5000");
  const [atResponse, setAtResponse] = useState("");
  const [modemStatus, setModemStatus] = useState<{
    connected: boolean;
    path: string;
    baudRate: number;
    lastError: string | null;
  } | null>(null);
  const [atModeReady, setAtModeReady] = useState<boolean | null>(null);

  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [logLimit, setLogLimit] = useState("100");
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newTokenName, setNewTokenName] = useState("integration");
  const [newTokenRole, setNewTokenRole] = useState<Role>("user");
  const [lastIssuedToken, setLastIssuedToken] = useState("");

  const [terminalEnabled, setTerminalEnabled] = useState(false);
  const [terminalConnected, setTerminalConnected] = useState(false);
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalDataSubscriptionRef = useRef<IDisposable | null>(null);

  const securityLocked = Boolean(user?.mustChangePassword);

  async function loadMe(activeToken: string): Promise<void> {
    if (!activeToken) {
      setUser(null);
      return;
    }
    const me = await api<{ user: Principal }>("/auth/me", activeToken);
    setUser(me.user);
  }

  async function loadLogs(activeToken: string): Promise<void> {
    const res = await api<{ items: CommandLog[] }>(
      `/logs?limit=${encodeURIComponent(logLimit)}`,
      activeToken
    );
    setLogs(res.items);
  }

  async function loadTokens(activeToken: string): Promise<void> {
    if (user?.role !== "admin") {
      return;
    }
    const res = await api<{ items: ApiToken[] }>("/tokens", activeToken);
    setTokens(res.items);
  }

  async function handleLogin(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; user: Principal }>("/auth/login", "", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setToken(res.accessToken);
      localStorage.setItem("jwt", res.accessToken);
      setUser(res.user);
      if (!res.user.mustChangePassword) {
        await loadLogs(res.accessToken);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; user: Principal }>(
        "/auth/change-password",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      );
      setToken(res.accessToken);
      localStorage.setItem("jwt", res.accessToken);
      setUser(res.user);
      setCurrentPassword("");
      setNewPassword("");
      await loadLogs(res.accessToken);
      if (res.user.role === "admin") {
        await loadTokens(res.accessToken);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendAt(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ response: string; durationMs: number }>("/at/send", token, {
        method: "POST",
        body: JSON.stringify({
          command: atCommand,
          timeoutMs: Number(atTimeout || "5000"),
        }),
      });
      setAtResponse(`${res.response}\n\n${res.durationMs} ms`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refreshModemStatus(activeToken: string): Promise<void> {
    const status = await api<{
      connected: boolean;
      path: string;
      baudRate: number;
      lastError: string | null;
    }>("/modem/status", activeToken);
    setModemStatus(status);
  }

  async function checkModemMode(activeToken: string): Promise<void> {
    const res = await api<{ atModeReady: boolean }>("/modem/mode", activeToken);
    setAtModeReady(res.atModeReady);
  }

  async function recoverModemMode(activeToken: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok: boolean; message: string }>(
        "/modem/recover-mode",
        activeToken,
        { method: "POST" }
      );
      setAtModeReady(res.ok);
      setAtResponse((prev) =>
        `${prev ? `${prev}\n\n` : ""}[mode] ${res.message}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function issueToken(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>("/tokens", token, {
        method: "POST",
        body: JSON.stringify({
          name: newTokenName,
          role: newTokenRole,
        }),
      });
      setLastIssuedToken(res.token);
      await loadTokens(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(id: number): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api<null>(`/tokens/${id}/revoke`, token, { method: "POST" });
      await loadTokens(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function logout(): void {
    setToken("");
    setUser(null);
    setLogs([]);
    setTokens([]);
    localStorage.removeItem("jwt");
    closeTerminal();
  }

  function initTerminal(): void {
    if (!terminalEnabled || !terminalHostRef.current || terminalRef.current) {
      return;
    }

    const term = new XtermTerminal({
      cols: 120,
      rows: 26,
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      theme: {
        background: "#10171f",
        foreground: "#d6deeb",
      },
    });

    term.open(terminalHostRef.current);
    term.writeln("Modem terminal ready.");
    term.writeln("Connect to stream raw modem data and input.");
    terminalRef.current = term;
  }

  function connectTerminal(): void {
    if (!token || terminalConnected || securityLocked) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/modem?token=${encodeURIComponent(token)}`
    );

    ws.onopen = () => {
      setTerminalConnected(true);
      terminalRef.current?.writeln("\r\n[connected]");
      terminalDataSubscriptionRef.current?.dispose();
      terminalDataSubscriptionRef.current =
        terminalRef.current?.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        }) ?? null;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type: string; data?: string };
        if (message.type === "data" && message.data) {
          terminalRef.current?.write(message.data);
          return;
        }
        if (message.type === "system" && message.data) {
          terminalRef.current?.writeln(`\r\n[${message.data}]`);
        }
      } catch {
        terminalRef.current?.write(String(event.data));
      }
    };

    ws.onerror = () => {
      terminalRef.current?.writeln("\r\n[socket error]");
      setTerminalConnected(false);
      terminalDataSubscriptionRef.current?.dispose();
      terminalDataSubscriptionRef.current = null;
    };

    ws.onclose = () => {
      terminalRef.current?.writeln("\r\n[disconnected]");
      setTerminalConnected(false);
      terminalDataSubscriptionRef.current?.dispose();
      terminalDataSubscriptionRef.current = null;
      wsRef.current = null;
    };

    wsRef.current = ws;
  }

  function closeTerminal(): void {
    terminalDataSubscriptionRef.current?.dispose();
    terminalDataSubscriptionRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setTerminalConnected(false);
  }

  useEffect(() => {
    if (!token) {
      return;
    }
    loadMe(token).catch(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !user || securityLocked) {
      return;
    }
    loadLogs(token).catch(() => undefined);
    refreshModemStatus(token).catch(() => undefined);
    checkModemMode(token).catch(() => undefined);
    if (user.role === "admin") {
      loadTokens(token).catch(() => undefined);
    }
  }, [token, user, securityLocked, logLimit]);

  useEffect(() => {
    if (!token || !user || securityLocked) {
      return;
    }
    const es = new EventSource(`/api/v1/logs/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as CommandLog;
      setLogs((prev) => [parsed, ...prev].slice(0, Number(logLimit) || 100));
    };
    es.onerror = () => {
      es.close();
      setTimeout(() => {
        if (token) {
          loadLogs(token).catch(() => undefined);
        }
      }, 1000);
    };
    return () => es.close();
  }, [token, user, securityLocked, logLimit]);

  useEffect(() => {
    initTerminal();
    return () => {
      terminalDataSubscriptionRef.current?.dispose();
      terminalDataSubscriptionRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalEnabled]);

  return (
    <View padding="size-300" UNSAFE_className="app-shell">
      <Flex direction="column" gap="size-200">
        <Heading level={2}>Modem Control Console</Heading>

        {error ? <Text UNSAFE_style={{ color: "#d12e2e" }}>{error}</Text> : null}
        {busy ? <ProgressCircle aria-label="busy" isIndeterminate size="S" /> : null}

        {!user ? (
          <LoginPanel
            username={username}
            password={password}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onLogin={handleLogin}
          />
        ) : (
          <SessionBar user={user} onLogout={logout} />
        )}

        {user ? (
          <>
            <PasswordPanel
              mustChangePassword={user.mustChangePassword}
              currentPassword={currentPassword}
              newPassword={newPassword}
              onCurrentPasswordChange={setCurrentPassword}
              onNewPasswordChange={setNewPassword}
              onSubmit={handleChangePassword}
            />

            {!securityLocked ? (
              <>
                <AtCommandsPanel
                  command={atCommand}
                  timeoutMs={atTimeout}
                  response={atResponse}
                  onCommandChange={setAtCommand}
                  onTimeoutChange={setAtTimeout}
                  onResponseChange={setAtResponse}
                  onSend={handleSendAt}
                />
                {modemStatus ? (
                  <View backgroundColor="gray-75" padding="size-150" borderRadius="medium">
                    <Flex direction="column" gap="size-100">
                      <Text>
                        Modem: {modemStatus.connected ? "connected" : "disconnected"} | path{" "}
                        {modemStatus.path} | baud {modemStatus.baudRate}
                        {modemStatus.lastError
                          ? ` | lastError: ${modemStatus.lastError}`
                          : ""}
                      </Text>
                      <Flex alignItems="center" gap="size-100" wrap>
                        <Text>
                          AT mode:{" "}
                          {atModeReady === null
                            ? "unknown"
                            : atModeReady
                              ? "ready"
                              : "not ready"}
                        </Text>
                        <Button
                          variant="secondary"
                          onPress={() => checkModemMode(token)}
                        >
                          Check
                        </Button>
                        <Button
                          variant="accent"
                          onPress={() => recoverModemMode(token)}
                        >
                          Recover
                        </Button>
                      </Flex>
                    </Flex>
                  </View>
                ) : null}

                <LogsPanel
                  logs={logs}
                  limit={logLimit}
                  onLimitChange={setLogLimit}
                  onRefresh={() => loadLogs(token)}
                />

                {user.role === "admin" ? (
                  <TokensPanel
                    tokens={tokens}
                    newTokenName={newTokenName}
                    newTokenRole={newTokenRole}
                    lastIssuedToken={lastIssuedToken}
                    onNameChange={setNewTokenName}
                    onRoleChange={setNewTokenRole}
                    onLastTokenChange={setLastIssuedToken}
                    onCreateToken={issueToken}
                    onRevokeToken={revokeToken}
                  />
                ) : null}

                <TerminalPanel
                  enabled={terminalEnabled}
                  connected={terminalConnected}
                  hostRef={terminalHostRef}
                  onToggleVisible={() => setTerminalEnabled((v) => !v)}
                  onToggleConnection={
                    terminalConnected ? closeTerminal : connectTerminal
                  }
                />
              </>
            ) : null}
          </>
        ) : null}
      </Flex>
    </View>
  );
}
