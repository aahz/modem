import { Button, ButtonGroup, Content, Heading, IllustratedMessage, Text, ToastContainer, ToastQueue } from "@react-spectrum/s2";
import { style } from '@react-spectrum/s2/style' with {type: 'macro'};
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { AtCommandsPanel } from "./components/AtCommandsPanel";
import { AtLogsTablePanel } from "./components/AtLogsTablePanel";
import { LoginPanel } from "./components/LoginPanel";
import { PasswordDialog } from "./components/PasswordDialog";
import { TokensPanel } from "./components/TokensPanel";
import { appStore } from "./store/app-store";

type PageKey = "home" | "tokens";

export const App = observer(function App() {
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

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
    ToastQueue.negative(appStore.error, { timeout: 5000 });
  }, [appStore.error]);

  useEffect(() => {
    if (appStore.user?.mustChangePassword) {
      setPasswordDialogOpen(true);
    }
  }, [appStore.user?.mustChangePassword]);

  useEffect(() => {
    if (!appStore.user) {
      setActivePage("home");
      setPasswordDialogOpen(false);
    }
  }, [appStore.user]);

  useEffect(() => {
    if (!appStore.token || !appStore.user || appStore.securityLocked) {
      return;
    }
    const timer = setInterval(() => {
      appStore.refreshModemStatus(appStore.token).catch(() => undefined);
    }, 1000);
    return () => clearInterval(timer);
  }, [appStore.token, appStore.user, appStore.securityLocked]);

  if (!appStore.user) {
    return (
      <div className="app-shell">
        <LoginPanel
          username={appStore.username}
          password={appStore.password}
          onUsernameChange={appStore.setUsername}
          onPasswordChange={appStore.setPassword}
          isBusy={appStore.busy}
          onLogin={appStore.handleLogin}
        />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader
        activePage={activePage}
        user={appStore.user}
        modemStatus={appStore.modemStatus}
        atModeReady={appStore.atModeReady}
        docsToken={appStore.token}
        isBusy={appStore.busy}
        onHome={() => setActivePage("home")}
        onTokens={() => setActivePage("tokens")}
        onCheckMode={() => appStore.checkModemMode(appStore.token)}
        onRecoverMode={() => appStore.recoverModemMode(appStore.token)}
        onChangePassword={() => setPasswordDialogOpen(true)}
        onLogout={appStore.logout}
      />

        <main style={{flex: 1, overflow: 'scroll'}}>
          {appStore.securityLocked
              ? (
                <section className={style({display: 'flex', justifyContent: 'center'})}>
                  <IllustratedMessage size="L">
                    <Heading>Password update required</Heading>
                    <Content>Access to modem commands is locked until admin password is changed.</Content>
                    <ButtonGroup>
                      <Button variant="accent" onPress={() => setPasswordDialogOpen(true)}>
                        Open password dialog
                      </Button>
                    </ButtonGroup>
                  </IllustratedMessage>
                </section>
              )
              : (
                  <>
                    {activePage === "home" ? (
                        <div className={style({display: 'flex', flexDirection: 'column', gap: 16})}>
                            <section className={style({display: 'flex', flexDirection: 'column', gap: 8})}>
                              <Heading level={4}>
                                Modem lease is {
                                  appStore.modemStatus?.lease?.active
                                      ? `acquired by ${appStore.modemStatus.lease.ownerUsername} (${appStore.modemStatus.lease.ownerRole}), expires: ${appStore.modemStatus.lease.expiresAt}`
                                      : 'currently available via ser2net'
                                }
                              </Heading>
                              <Text>
                                TCP bridge: {appStore.modemStatus?.ser2net?.host}:{appStore.modemStatus?.ser2net?.port} (clients: {appStore.modemStatus?.ser2net?.clients ?? 0})
                              </Text>
                              <ButtonGroup>
                                <Button
                                  variant="accent"
                                  isDisabled={appStore.busy || !!appStore.modemStatus?.lease?.active}
                                  onPress={() => appStore.acquireModemLease(appStore.token)}
                                >
                                  Acquire (5 min)
                                </Button>
                                <Button
                                  variant="primary"
                                  isDisabled={appStore.busy || !appStore.modemStatus?.lease?.active}
                                  onPress={() => appStore.releaseModemLease(appStore.token)}
                                >
                                  Release
                                </Button>
                              </ButtonGroup>
                            </section>

                            <AtCommandsPanel
                                command={appStore.atCommand}
                                timeoutMs={appStore.atTimeout}
                                response={appStore.atResponse}
                                onCommandChange={appStore.setAtCommand}
                                onTimeoutChange={appStore.setAtTimeout}
                                onResponseChange={appStore.setAtResponse}
                                onSend={appStore.handleSendAt}
                            />

                              <AtLogsTablePanel
                                  logs={appStore.logs}
                                  onRefresh={() => appStore.loadLogs(appStore.token)}
                                  onCleanup={() => appStore.cleanupLogs(appStore.token)}
                                  canCleanup={appStore.user.role === "admin"}
                              />

                        </div>
                    ) : null}

                    {activePage === "tokens" && (
                        <>
                          {appStore.user.role === "admin"
                              ? (
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
                              )
                              : (
                                  <section className={style({display: 'flex', justifyContent: 'center'})}>
                                    <Heading level={3}>No access</Heading>
                                    <Text>Token management is available for admins only.</Text>
                                  </section>
                              )
                          }
                        </>
                    )}
                  </>
              )}
        </main>

      <PasswordDialog
        isOpen={passwordDialogOpen}
        mustChangePassword={appStore.user.mustChangePassword}
        currentPassword={appStore.currentPassword}
        newPassword={appStore.newPassword}
        isBusy={appStore.busy}
        onCurrentPasswordChange={appStore.setCurrentPassword}
        onNewPasswordChange={appStore.setNewPassword}
        onSubmit={async () => {
          await appStore.handleChangePassword();
          if (!appStore.user?.mustChangePassword) {
            setPasswordDialogOpen(false);
          }
        }}
        onClose={() => {
          if (!appStore.user?.mustChangePassword) {
            setPasswordDialogOpen(false);
          }
        }}
      />

      <ToastContainer />
    </div>
  );
});
