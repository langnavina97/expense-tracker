import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ConfirmState {
  message: string;
  resolve: (result: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (message: string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  function respond(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="modal-backdrop" onClick={() => respond(false)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p>{state.message}</p>
            <div className="confirm-modal-actions">
              <button className="btn-ghost" onClick={() => respond(false)}>
                Cancel
              </button>
              <button className="btn-danger-solid" onClick={() => respond(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used within a ConfirmProvider");
  return context.confirm;
}
