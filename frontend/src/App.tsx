import { Button, ProgressCircle, Text, ToastContainer, ToastQueue } from "@react-spectrum/s2";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import {style} from '@react-spectrum/s2/style' with {type: 'macro'};

import { AtCommandsPanel } from "./components/AtCommandsPanel";
import { LoginPanel } from "./components/LoginPanel";
import { LogsPanel } from "./components/LogsPanel";
import { PasswordPanel } from "./components/PasswordPanel";
import { SessionBar } from "./components/SessionBar";
import { TokensPanel } from "./components/TokensPanel";
import { appStore } from "./store/app-store";

export const App = observer(function App() {
  useEffect(() => {
    if (!appStore.token) {
      return;
    }
    appStore.loadMe(appStore.token).catch(() => appStore.logout());
    return () => appStore.stopLogsStream();
  }, [appStore.token]);

  useEffect(() => {
    if (!appStore.token || !appStore.user || appStore.securityLocked) {
      appStore.stopLogsStream();
      return;
    }
    appStore.loadDashboardData(appStore.token).catch(() => undefined);
    appStore.startLogsStream();
    return () => appStore.stopLogsStream();
  }, [appStore.token, appStore.user, appStore.securityLocked, appStore.logLimit]);

  useEffect(() => {
    if (!appStore.error) {
      return;
    }

    ToastQueue.negative(appStore.error, {
      timeout: 5000,
    });
  }, [appStore.error]);

  return (
    <div className="app-shell" style={{ padding: "24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {appStore.busy ? <ProgressCircle aria-label="busy" isIndeterminate size="S" /> : null}

        {!appStore.user ? (
          <LoginPanel
            username={appStore.username}
            password={appStore.password}
            onUsernameChange={appStore.setUsername}
            onPasswordChange={appStore.setPassword}
            isBusy={appStore.busy}
            onLogin={appStore.handleLogin}
          />
        ) : (
          <SessionBar user={appStore.user} onLogout={appStore.logout} />
        )}

        {appStore.user ? (
          <>
            <PasswordPanel
              mustChangePassword={appStore.user.mustChangePassword}
              currentPassword={appStore.currentPassword}
              newPassword={appStore.newPassword}
              onCurrentPasswordChange={appStore.setCurrentPassword}
              onNewPasswordChange={appStore.setNewPassword}
              onSubmit={appStore.handleChangePassword}
            />

            {!appStore.securityLocked ? (
              <>
                <AtCommandsPanel
                  command={appStore.atCommand}
                  timeoutMs={appStore.atTimeout}
                  response={appStore.atResponse}
                  onCommandChange={appStore.setAtCommand}
                  onTimeoutChange={appStore.setAtTimeout}
                  onResponseChange={appStore.setAtResponse}
                  onSend={appStore.handleSendAt}
                />

                {appStore.modemStatus ? (
                  <div
                    style={{
                      background: "#f3f3f3",
                      padding: "12px",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <Text>
                        Modem: {appStore.modemStatus.connected ? "connected" : "disconnected"} | path{" "}
                        {appStore.modemStatus.path} | baud {appStore.modemStatus.baudRate}
                        {appStore.modemStatus.lastError
                          ? ` | lastError: ${appStore.modemStatus.lastError}`
                          : ""}
                      </Text>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <Text>
                          AT mode:{" "}
                          {appStore.atModeReady === null
                            ? "unknown"
                            : appStore.atModeReady
                              ? "ready"
                              : "not ready"}
                        </Text>
                        <Button
                          variant="secondary"
                          onPress={() => appStore.checkModemMode(appStore.token)}
                        >
                          Check
                        </Button>
                        <Button
                          variant="accent"
                          onPress={() => appStore.recoverModemMode(appStore.token)}
                        >
                          Recover
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <LogsPanel
                  logs={appStore.logs}
                  limit={appStore.logLimit}
                  onLimitChange={appStore.setLogLimit}
                  onRefresh={() => appStore.loadLogs(appStore.token)}
                  onCleanup={() => appStore.cleanupLogs(appStore.token)}
                  canCleanup={appStore.user.role === "admin"}
                />

                {appStore.user.role === "admin" ? (
                  <TokensPanel
                    tokens={appStore.tokens}
                    newTokenName={appStore.newTokenName}
                    newTokenRole={appStore.newTokenRole}
                    lastIssuedToken={appStore.lastIssuedToken}
                    onNameChange={appStore.setNewTokenName}
                    onRoleChange={appStore.setNewTokenRole}
                    onLastTokenChange={appStore.setLastIssuedToken}
                    onCreateToken={appStore.issueToken}
                    onRevokeToken={appStore.revokeToken}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </div>
      <ToastContainer />
    </div>
  );
});
