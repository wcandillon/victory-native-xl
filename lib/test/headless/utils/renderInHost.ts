import { createRequire } from "node:module";
import { createContext, type ReactNode } from "react";

const require = createRequire(import.meta.url);
const ReactReconciler = require("react-reconciler");
const {
  DefaultEventPriority,
  IdleEventPriority,
} = require("react-reconciler/constants");

let currentUpdatePriority = 0;

/**
 * A React renderer that stands in for React Native when a test needs the app
 * and the canvas to be rendered by two different renderers, as they are on a
 * device. It renders no host components: the React Native stubs used by the
 * headless tests only return their children.
 *
 * Like Fabric, and like Skia's renderer, it is not a primary renderer.
 */
const hostReconciler = ReactReconciler({
  isPrimaryRenderer: false,
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  getRootHostContext: () => ({}),
  getChildHostContext: () => ({}),
  shouldSetTextContent: () => false,
  createInstance: () => {
    throw new Error("The host renderer for tests has no host components.");
  },
  createTextInstance: () => {
    throw new Error("The host renderer for tests has no text nodes.");
  },
  prepareForCommit: () => null,
  resetAfterCommit: () => {},
  clearContainer: () => {},
  preparePortalMount: () => {},
  getPublicInstance: (instance: unknown) => instance,
  getCurrentEventPriority: () => DefaultEventPriority,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  detachDeletedInstance: () => {},
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent: () => {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  requestPostPaintCallback: () => {},
  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: () => {},
  suspendInstance: () => {},
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  HostTransitionContext: createContext(null),
  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority;
  },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,
  resetFormInstance: () => {},
});

/**
 * Lets the work that follows a commit run: effects, the canvas updates they
 * trigger, and the renders that follow from state set in those effects. Both
 * renderers schedule that work as tasks, so a few turns of the event loop are
 * enough.
 */
const settle = async () => {
  for (let turn = 0; turn < 10; turn++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

export type HostRoot = {
  render: (element: ReactNode) => Promise<void>;
  /**
   * Renders with the lowest priority: React pauses this work to let anything
   * more urgent, like an update of a canvas, run first.
   */
  renderInBackground: (element: ReactNode) => Promise<void>;
  unmount: () => Promise<void>;
};

/**
 * Creates a root in the stand-in for the app's renderer. `render` resolves
 * once the element is committed and the work that follows has settled.
 */
export const createHostRoot = (): HostRoot => {
  const CONCURRENT_ROOT = 1;
  const root = hostReconciler.createContainer(
    {},
    CONCURRENT_ROOT,
    null,
    false,
    null,
    "",
    console.error,
    null,
  );

  const render = async (element: ReactNode) => {
    await new Promise<void>((resolve) => {
      hostReconciler.updateContainer(element, root, null, () => resolve());
    });
    await settle();
  };

  const renderInBackground = async (element: ReactNode) => {
    await new Promise<void>((resolve) => {
      const previousPriority = currentUpdatePriority;
      currentUpdatePriority = IdleEventPriority;
      try {
        hostReconciler.updateContainer(element, root, null, () => resolve());
      } finally {
        currentUpdatePriority = previousPriority;
      }
    });
    await settle();
  };

  return { render, renderInBackground, unmount: () => render(null) };
};
