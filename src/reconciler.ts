// Render-once React host: turns a React element into a plain host tree.
// No updates, no effects that matter, no Suspense: render, commit, read, unmount.
import { createContext, type ReactNode } from 'react';
import Reconciler from 'react-reconciler';
import { DefaultEventPriority, LegacyRoot, NoEventPriority } from 'react-reconciler/constants.js';
import { ValidationError } from './diagnostics.js';

export type HostElement = {
  kind: 'element';
  type: string;
  props: Record<string, unknown>;
  children: HostNode[];
};
export type HostText = { kind: 'text'; text: string };
export type HostNode = HostElement | HostText;
type Container = { children: HostNode[] };

const updatesNotSupported = () => {
  throw new ValidationError(
    'RTP_STATE_UPDATE',
    'react-tagged-pdf renders once; state updates after the first render are not supported.',
  );
};

let currentUpdatePriority: number = NoEventPriority;

const hostConfig = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: false,

  createInstance(type: string, props: Record<string, unknown>): HostElement {
    const { children: _children, ...rest } = props;
    return { kind: 'element', type, props: rest, children: [] };
  },
  createTextInstance(text: string): HostText {
    return { kind: 'text', text };
  },
  appendInitialChild(parent: HostElement, child: HostNode) {
    parent.children.push(child);
  },
  appendChild(parent: HostElement, child: HostNode) {
    parent.children.push(child);
  },
  appendChildToContainer(container: Container, child: HostNode) {
    container.children.push(child);
  },
  insertBefore: updatesNotSupported,
  insertInContainerBefore: updatesNotSupported,
  removeChild() {},
  removeChildFromContainer() {},
  clearContainer(container: Container) {
    container.children = [];
  },
  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,
  // Must be non-null, otherwise React reports "Expected host context to exist".
  getRootHostContext: () => ({}),
  getChildHostContext: (parentContext: object) => parentContext,
  getPublicInstance: (instance: unknown) => instance,
  prepareForCommit: () => null,
  resetAfterCommit() {},
  preparePortalMount() {},
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,

  setCurrentUpdatePriority(p: number) {
    currentUpdatePriority = p;
  },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  prepareScopeUpdate() {},
  getInstanceFromScope: () => null,
  detachDeletedInstance() {},

  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit() {},
  suspendInstance() {},
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  HostTransitionContext: createContext(null),
  resetFormInstance() {},
  requestPostPaintCallback() {},
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent() {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,

  commitUpdate: updatesNotSupported,
  commitTextUpdate: updatesNotSupported,
  commitMount() {},
  resetTextContent() {},
  hideInstance() {},
  unhideInstance() {},
  hideTextInstance() {},
  unhideTextInstance() {},

  rendererPackageName: 'react-tagged-pdf',
  rendererVersion: '0.0.0',
  extraDevToolsConfig: null,
};

type OpaqueRoot = unknown;
type OnError = (error: unknown) => void;
/**
 * The slice of the reconciler API this renderer uses. @types/react-reconciler
 * (0.31) does not track the current host-config keys or these entry points
 * precisely, so the untyped boundary is contained in this one cast.
 */
type RenderOnceReconciler = {
  createContainer(
    container: Container,
    tag: typeof LegacyRoot,
    hydrationCallbacks: null,
    isStrictMode: boolean,
    concurrentUpdatesByDefaultOverride: null,
    identifierPrefix: string,
    onUncaughtError: OnError,
    onCaughtError: OnError,
    onRecoverableError: OnError,
    transitionCallbacks: null,
  ): OpaqueRoot;
  updateContainerSync(element: ReactNode, root: OpaqueRoot, parentComponent: null, callback: null): void;
  flushSyncWork(): void;
};

const reconciler = Reconciler(hostConfig as never) as unknown as RenderOnceReconciler;

/** Render `element` once and return the committed host tree. Errors thrown while rendering are rethrown. */
export function renderTree(element: ReactNode): HostNode[] {
  const container: Container = { children: [] };
  let error: unknown;
  let failed = false;
  // React 19 does not rethrow render errors; it reports them to these callbacks.
  const onError = (e: unknown) => {
    if (!failed) {
      failed = true;
      error = e;
    }
  };
  const root = reconciler.createContainer(container, LegacyRoot, null, false, null, '', onError, onError, onError, null);
  reconciler.updateContainerSync(element, root, null, null);
  reconciler.flushSyncWork();
  // Copy before unmounting so the result does not depend on what unmount does to the container.
  const children = [...container.children];
  reconciler.updateContainerSync(null, root, null, null);
  reconciler.flushSyncWork();
  if (failed) throw error;
  return children;
}
