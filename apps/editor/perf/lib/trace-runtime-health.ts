/** Diagnostic-only observer: reuse returned WebGL contexts, never create another. */
export function installTraceRuntimeObservation(): void {
	const target = window as Window & { __BISKIQ_TRACE_RUNTIME__?: { read(): unknown; dispose(): void } };
	const original = HTMLCanvasElement.prototype.getContext;
	const seen = new WeakSet<object>();
	const entries: { id: number; kind: string; canvas: WeakRef<HTMLCanvasElement>; context: WeakRef<WebGLRenderingContext>; lostEvents: number; restoredEvents: number }[] = [];
	const getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
		const context = Reflect.apply(original, this, args) as RenderingContext | null;
		if (context && (args[0] === 'webgl2' || args[0] === 'webgl' || args[0] === 'experimental-webgl') && !seen.has(context)) {
			seen.add(context);
			const entry = { id: entries.length + 1, kind: String(args[0]), canvas: new WeakRef(this),
				context: new WeakRef(context as WebGLRenderingContext), lostEvents: 0, restoredEvents: 0 };
			entries.push(entry);
			this.addEventListener('webglcontextlost', () => { entry.lostEvents++; });
			this.addEventListener('webglcontextrestored', () => { entry.restoredEvents++; });
		}
		return context;
	} as typeof original;
	HTMLCanvasElement.prototype.getContext = getContext;
	target.__BISKIQ_TRACE_RUNTIME__ = {
		read() {
			return entries.map((entry) => {
				const canvas = entry.canvas.deref(), context = entry.context.deref();
				const extension = context && !context.isContextLost() ? context.getExtension('WEBGL_debug_renderer_info') : null;
				return { id: entry.id, kind: entry.kind, connected: canvas?.isConnected ?? false,
					width: canvas?.width ?? null, height: canvas?.height ?? null, contextLost: context?.isContextLost() ?? null,
					lostEvents: entry.lostEvents, restoredEvents: entry.restoredEvents,
					renderer: context?.getParameter(context.RENDERER) ?? null, vendor: context?.getParameter(context.VENDOR) ?? null,
					version: context?.getParameter(context.VERSION) ?? null,
					unmaskedRenderer: extension ? context?.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null };
			});
		},
		dispose() {
			if (HTMLCanvasElement.prototype.getContext === getContext) HTMLCanvasElement.prototype.getContext = original;
			delete target.__BISKIQ_TRACE_RUNTIME__;
		}
	};
}
