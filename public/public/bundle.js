var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }
    function hasContext(key) {
        return get_current_component().$$.context.has(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.37.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }
    /**
     * Base class to create strongly typed Svelte components.
     * This only exists for typing purposes and should be used in `.d.ts` files.
     *
     * ### Example:
     *
     * You have component library on npm called `component-library`, from which
     * you export a component called `MyComponent`. For Svelte+TypeScript users,
     * you want to provide typings. Therefore you create a `index.d.ts`:
     * ```ts
     * import { SvelteComponentTyped } from "svelte";
     * export class MyComponent extends SvelteComponentTyped<{foo: string}> {}
     * ```
     * Typing this makes it possible for IDEs like VS Code with the Svelte extension
     * to provide intellisense and to use the component like this in a Svelte file
     * with TypeScript:
     * ```svelte
     * <script lang="ts">
     * 	import { MyComponent } from "component-library";
     * </script>
     * <MyComponent foo={'bar'} />
     * ```
     *
     * #### Why not make this part of `SvelteComponent(Dev)`?
     * Because
     * ```ts
     * class ASubclassOfSvelteComponent extends SvelteComponent<{foo: string}> {}
     * const component: typeof SvelteComponent = ASubclassOfSvelteComponent;
     * ```
     * will throw a type error, so we need to seperate the more strictly typed class.
     */
    class SvelteComponentTyped extends SvelteComponentDev {
        constructor(options) {
            super(options);
        }
    }



    var svelte = /*#__PURE__*/Object.freeze({
        __proto__: null,
        SvelteComponent: SvelteComponentDev,
        SvelteComponentTyped: SvelteComponentTyped,
        afterUpdate: afterUpdate,
        beforeUpdate: beforeUpdate,
        createEventDispatcher: createEventDispatcher,
        getContext: getContext,
        hasContext: hasContext,
        onDestroy: onDestroy,
        onMount: onMount,
        setContext: setContext,
        tick: tick
    });

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    /* node_modules\svelte-simple-modal\src\Modal.svelte generated by Svelte v3.37.0 */

    const { Object: Object_1, window: window_1 } = globals;
    const file = "node_modules\\svelte-simple-modal\\src\\Modal.svelte";

    // (312:0) {#if Component}
    function create_if_block(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let t;
    	let div0;
    	let switch_instance;
    	let div1_transition;
    	let div3_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*state*/ ctx[0].closeButton && create_if_block_1(ctx);
    	var switch_value = /*Component*/ ctx[1];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			div0 = element("div");
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			attr_dev(div0, "class", "content svelte-2wx9ab");
    			attr_dev(div0, "style", /*cssContent*/ ctx[8]);
    			add_location(div0, file, 339, 8, 8098);
    			attr_dev(div1, "class", "window svelte-2wx9ab");
    			attr_dev(div1, "role", "dialog");
    			attr_dev(div1, "aria-modal", "true");
    			attr_dev(div1, "style", /*cssWindow*/ ctx[7]);
    			add_location(div1, file, 320, 6, 7473);
    			attr_dev(div2, "class", "window-wrap svelte-2wx9ab");
    			attr_dev(div2, "style", /*cssWindowWrap*/ ctx[6]);
    			add_location(div2, file, 319, 4, 7402);
    			attr_dev(div3, "class", "bg svelte-2wx9ab");
    			attr_dev(div3, "style", /*cssBg*/ ctx[5]);
    			add_location(div3, file, 312, 2, 7236);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append_dev(div1, t);
    			append_dev(div1, div0);

    			if (switch_instance) {
    				mount_component(switch_instance, div0, null);
    			}

    			/*div1_binding*/ ctx[37](div1);
    			/*div2_binding*/ ctx[38](div2);
    			/*div3_binding*/ ctx[39](div3);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						div1,
    						"introstart",
    						function () {
    							if (is_function(/*onOpen*/ ctx[12])) /*onOpen*/ ctx[12].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"outrostart",
    						function () {
    							if (is_function(/*onClose*/ ctx[13])) /*onClose*/ ctx[13].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"introend",
    						function () {
    							if (is_function(/*onOpened*/ ctx[14])) /*onOpened*/ ctx[14].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"outroend",
    						function () {
    							if (is_function(/*onClosed*/ ctx[15])) /*onClosed*/ ctx[15].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(div3, "click", /*handleOuterClick*/ ctx[19], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*state*/ ctx[0].closeButton) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*state*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (switch_value !== (switch_value = /*Component*/ ctx[1])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, div0, null);
    				} else {
    					switch_instance = null;
    				}
    			}

    			if (!current || dirty[0] & /*cssContent*/ 256) {
    				attr_dev(div0, "style", /*cssContent*/ ctx[8]);
    			}

    			if (!current || dirty[0] & /*cssWindow*/ 128) {
    				attr_dev(div1, "style", /*cssWindow*/ ctx[7]);
    			}

    			if (!current || dirty[0] & /*cssWindowWrap*/ 64) {
    				attr_dev(div2, "style", /*cssWindowWrap*/ ctx[6]);
    			}

    			if (!current || dirty[0] & /*cssBg*/ 32) {
    				attr_dev(div3, "style", /*cssBg*/ ctx[5]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[11], /*state*/ ctx[0].transitionWindowProps, true);
    				div1_transition.run(1);
    			});

    			add_render_callback(() => {
    				if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[10], /*state*/ ctx[0].transitionBgProps, true);
    				div3_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[11], /*state*/ ctx[0].transitionWindowProps, false);
    			div1_transition.run(0);
    			if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[10], /*state*/ ctx[0].transitionBgProps, false);
    			div3_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
    			if (switch_instance) destroy_component(switch_instance);
    			/*div1_binding*/ ctx[37](null);
    			if (detaching && div1_transition) div1_transition.end();
    			/*div2_binding*/ ctx[38](null);
    			/*div3_binding*/ ctx[39](null);
    			if (detaching && div3_transition) div3_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(312:0) {#if Component}",
    		ctx
    	});

    	return block;
    }

    // (333:8) {#if state.closeButton}
    function create_if_block_1(ctx) {
    	let show_if;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (dirty[0] & /*state*/ 1) show_if = !!/*isFunction*/ ctx[16](/*state*/ ctx[0].closeButton);
    		if (show_if) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx, [-1]);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx, dirty);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(333:8) {#if state.closeButton}",
    		ctx
    	});

    	return block;
    }

    // (336:10) {:else}
    function create_else_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			attr_dev(button, "class", "close svelte-2wx9ab");
    			attr_dev(button, "style", /*cssCloseButton*/ ctx[9]);
    			add_location(button, file, 336, 12, 7995);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*close*/ ctx[17], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*cssCloseButton*/ 512) {
    				attr_dev(button, "style", /*cssCloseButton*/ ctx[9]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(336:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (334:10) {#if isFunction(state.closeButton)}
    function create_if_block_2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*state*/ ctx[0].closeButton;

    	function switch_props(ctx) {
    		return {
    			props: { onClose: /*close*/ ctx[17] },
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props(ctx));
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (switch_value !== (switch_value = /*state*/ ctx[0].closeButton)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props(ctx));
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(334:10) {#if isFunction(state.closeButton)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*Component*/ ctx[1] && create_if_block(ctx);
    	const default_slot_template = /*#slots*/ ctx[36].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[35], null);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t = space();
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window_1, "keydown", /*handleKeydown*/ ctx[18], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*Component*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*Component*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty[1] & /*$$scope*/ 16) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[35], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function bind(Component, props = {}) {
    	return function ModalComponent(options) {
    		return new Component({
    				...options,
    				props: { ...props, ...options.props }
    			});
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Modal", slots, ['default']);
    	const dispatch = createEventDispatcher();
    	const baseSetContext = setContext;
    	let { show = null } = $$props;
    	let { key = "simple-modal" } = $$props;
    	let { closeButton = true } = $$props;
    	let { closeOnEsc = true } = $$props;
    	let { closeOnOuterClick = true } = $$props;
    	let { styleBg = {} } = $$props;
    	let { styleWindowWrap = {} } = $$props;
    	let { styleWindow = {} } = $$props;
    	let { styleContent = {} } = $$props;
    	let { styleCloseButton = {} } = $$props;
    	let { setContext: setContext$1 = baseSetContext } = $$props;
    	let { transitionBg = fade } = $$props;
    	let { transitionBgProps = { duration: 250 } } = $$props;
    	let { transitionWindow = transitionBg } = $$props;
    	let { transitionWindowProps = transitionBgProps } = $$props;

    	const defaultState = {
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps
    	};

    	let state = { ...defaultState };
    	let Component = null;
    	let background;
    	let wrap;
    	let modalWindow;
    	let scrollY;
    	let cssBg;
    	let cssWindowWrap;
    	let cssWindow;
    	let cssContent;
    	let cssCloseButton;
    	let currentTransitionBg;
    	let currentTransitionWindow;
    	let prevBodyPosition;
    	let prevBodyOverflow;
    	const camelCaseToDash = str => str.replace(/([a-zA-Z])(?=[A-Z])/g, "$1-").toLowerCase();
    	const toCssString = props => Object.keys(props).reduce((str, key) => `${str}; ${camelCaseToDash(key)}: ${props[key]}`, "");
    	const isFunction = f => !!(f && f.constructor && f.call && f.apply);

    	const updateStyleTransition = () => {
    		$$invalidate(5, cssBg = toCssString(state.styleBg));
    		$$invalidate(6, cssWindowWrap = toCssString(state.styleWindowWrap));
    		$$invalidate(7, cssWindow = toCssString(state.styleWindow));
    		$$invalidate(8, cssContent = toCssString(state.styleContent));
    		$$invalidate(9, cssCloseButton = toCssString(state.styleCloseButton));
    		$$invalidate(10, currentTransitionBg = state.transitionBg);
    		$$invalidate(11, currentTransitionWindow = state.transitionWindow);
    	};

    	const toVoid = () => {
    		
    	};

    	let onOpen = toVoid;
    	let onClose = toVoid;
    	let onOpened = toVoid;
    	let onClosed = toVoid;

    	const open = (NewComponent, newProps = {}, options = {}, callback = {}) => {
    		$$invalidate(1, Component = bind(NewComponent, newProps));
    		$$invalidate(0, state = { ...defaultState, ...options });
    		updateStyleTransition();
    		disableScroll();

    		($$invalidate(12, onOpen = event => {
    			if (callback.onOpen) callback.onOpen(event);
    			dispatch("opening");
    		}), $$invalidate(13, onClose = event => {
    			if (callback.onClose) callback.onClose(event);
    			dispatch("closing");
    		}), $$invalidate(14, onOpened = event => {
    			if (callback.onOpened) callback.onOpened(event);
    			dispatch("opened");
    		}));

    		$$invalidate(15, onClosed = event => {
    			if (callback.onClosed) callback.onClosed(event);
    			dispatch("closed");
    		});
    	};

    	const close = (callback = {}) => {
    		$$invalidate(13, onClose = callback.onClose || onClose);
    		$$invalidate(15, onClosed = callback.onClosed || onClosed);
    		$$invalidate(1, Component = null);
    		enableScroll();
    	};

    	const handleKeydown = event => {
    		if (state.closeOnEsc && Component && event.key === "Escape") {
    			event.preventDefault();
    			close();
    		}

    		if (Component && event.key === "Tab") {
    			// trap focus
    			const nodes = modalWindow.querySelectorAll("*");

    			const tabbable = Array.from(nodes).filter(node => node.tabIndex >= 0);
    			let index = tabbable.indexOf(document.activeElement);
    			if (index === -1 && event.shiftKey) index = 0;
    			index += tabbable.length + (event.shiftKey ? -1 : 1);
    			index %= tabbable.length;
    			tabbable[index].focus();
    			event.preventDefault();
    		}
    	};

    	const handleOuterClick = event => {
    		if (state.closeOnOuterClick && (event.target === background || event.target === wrap)) {
    			event.preventDefault();
    			close();
    		}
    	};

    	const disableScroll = () => {
    		scrollY = window.scrollY;
    		prevBodyPosition = document.body.style.position;
    		prevBodyOverflow = document.body.style.overflow;
    		document.body.style.position = "fixed";
    		document.body.style.top = `-${scrollY}px`;
    		document.body.style.overflow = "hidden";
    	};

    	const enableScroll = () => {
    		document.body.style.position = prevBodyPosition || "";
    		document.body.style.top = "";
    		document.body.style.overflow = prevBodyOverflow || "";
    		window.scrollTo(0, scrollY);
    	};

    	setContext$1(key, { open, close });

    	onDestroy(() => {
    		close();
    	});

    	const writable_props = [
    		"show",
    		"key",
    		"closeButton",
    		"closeOnEsc",
    		"closeOnOuterClick",
    		"styleBg",
    		"styleWindowWrap",
    		"styleWindow",
    		"styleContent",
    		"styleCloseButton",
    		"setContext",
    		"transitionBg",
    		"transitionBgProps",
    		"transitionWindow",
    		"transitionWindowProps"
    	];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			modalWindow = $$value;
    			$$invalidate(4, modalWindow);
    		});
    	}

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			wrap = $$value;
    			$$invalidate(3, wrap);
    		});
    	}

    	function div3_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			background = $$value;
    			$$invalidate(2, background);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("show" in $$props) $$invalidate(20, show = $$props.show);
    		if ("key" in $$props) $$invalidate(21, key = $$props.key);
    		if ("closeButton" in $$props) $$invalidate(22, closeButton = $$props.closeButton);
    		if ("closeOnEsc" in $$props) $$invalidate(23, closeOnEsc = $$props.closeOnEsc);
    		if ("closeOnOuterClick" in $$props) $$invalidate(24, closeOnOuterClick = $$props.closeOnOuterClick);
    		if ("styleBg" in $$props) $$invalidate(25, styleBg = $$props.styleBg);
    		if ("styleWindowWrap" in $$props) $$invalidate(26, styleWindowWrap = $$props.styleWindowWrap);
    		if ("styleWindow" in $$props) $$invalidate(27, styleWindow = $$props.styleWindow);
    		if ("styleContent" in $$props) $$invalidate(28, styleContent = $$props.styleContent);
    		if ("styleCloseButton" in $$props) $$invalidate(29, styleCloseButton = $$props.styleCloseButton);
    		if ("setContext" in $$props) $$invalidate(30, setContext$1 = $$props.setContext);
    		if ("transitionBg" in $$props) $$invalidate(31, transitionBg = $$props.transitionBg);
    		if ("transitionBgProps" in $$props) $$invalidate(32, transitionBgProps = $$props.transitionBgProps);
    		if ("transitionWindow" in $$props) $$invalidate(33, transitionWindow = $$props.transitionWindow);
    		if ("transitionWindowProps" in $$props) $$invalidate(34, transitionWindowProps = $$props.transitionWindowProps);
    		if ("$$scope" in $$props) $$invalidate(35, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		bind,
    		svelte,
    		fade,
    		createEventDispatcher,
    		dispatch,
    		baseSetContext,
    		show,
    		key,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		setContext: setContext$1,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		defaultState,
    		state,
    		Component,
    		background,
    		wrap,
    		modalWindow,
    		scrollY,
    		cssBg,
    		cssWindowWrap,
    		cssWindow,
    		cssContent,
    		cssCloseButton,
    		currentTransitionBg,
    		currentTransitionWindow,
    		prevBodyPosition,
    		prevBodyOverflow,
    		camelCaseToDash,
    		toCssString,
    		isFunction,
    		updateStyleTransition,
    		toVoid,
    		onOpen,
    		onClose,
    		onOpened,
    		onClosed,
    		open,
    		close,
    		handleKeydown,
    		handleOuterClick,
    		disableScroll,
    		enableScroll
    	});

    	$$self.$inject_state = $$props => {
    		if ("show" in $$props) $$invalidate(20, show = $$props.show);
    		if ("key" in $$props) $$invalidate(21, key = $$props.key);
    		if ("closeButton" in $$props) $$invalidate(22, closeButton = $$props.closeButton);
    		if ("closeOnEsc" in $$props) $$invalidate(23, closeOnEsc = $$props.closeOnEsc);
    		if ("closeOnOuterClick" in $$props) $$invalidate(24, closeOnOuterClick = $$props.closeOnOuterClick);
    		if ("styleBg" in $$props) $$invalidate(25, styleBg = $$props.styleBg);
    		if ("styleWindowWrap" in $$props) $$invalidate(26, styleWindowWrap = $$props.styleWindowWrap);
    		if ("styleWindow" in $$props) $$invalidate(27, styleWindow = $$props.styleWindow);
    		if ("styleContent" in $$props) $$invalidate(28, styleContent = $$props.styleContent);
    		if ("styleCloseButton" in $$props) $$invalidate(29, styleCloseButton = $$props.styleCloseButton);
    		if ("setContext" in $$props) $$invalidate(30, setContext$1 = $$props.setContext);
    		if ("transitionBg" in $$props) $$invalidate(31, transitionBg = $$props.transitionBg);
    		if ("transitionBgProps" in $$props) $$invalidate(32, transitionBgProps = $$props.transitionBgProps);
    		if ("transitionWindow" in $$props) $$invalidate(33, transitionWindow = $$props.transitionWindow);
    		if ("transitionWindowProps" in $$props) $$invalidate(34, transitionWindowProps = $$props.transitionWindowProps);
    		if ("state" in $$props) $$invalidate(0, state = $$props.state);
    		if ("Component" in $$props) $$invalidate(1, Component = $$props.Component);
    		if ("background" in $$props) $$invalidate(2, background = $$props.background);
    		if ("wrap" in $$props) $$invalidate(3, wrap = $$props.wrap);
    		if ("modalWindow" in $$props) $$invalidate(4, modalWindow = $$props.modalWindow);
    		if ("scrollY" in $$props) scrollY = $$props.scrollY;
    		if ("cssBg" in $$props) $$invalidate(5, cssBg = $$props.cssBg);
    		if ("cssWindowWrap" in $$props) $$invalidate(6, cssWindowWrap = $$props.cssWindowWrap);
    		if ("cssWindow" in $$props) $$invalidate(7, cssWindow = $$props.cssWindow);
    		if ("cssContent" in $$props) $$invalidate(8, cssContent = $$props.cssContent);
    		if ("cssCloseButton" in $$props) $$invalidate(9, cssCloseButton = $$props.cssCloseButton);
    		if ("currentTransitionBg" in $$props) $$invalidate(10, currentTransitionBg = $$props.currentTransitionBg);
    		if ("currentTransitionWindow" in $$props) $$invalidate(11, currentTransitionWindow = $$props.currentTransitionWindow);
    		if ("prevBodyPosition" in $$props) prevBodyPosition = $$props.prevBodyPosition;
    		if ("prevBodyOverflow" in $$props) prevBodyOverflow = $$props.prevBodyOverflow;
    		if ("onOpen" in $$props) $$invalidate(12, onOpen = $$props.onOpen);
    		if ("onClose" in $$props) $$invalidate(13, onClose = $$props.onClose);
    		if ("onOpened" in $$props) $$invalidate(14, onOpened = $$props.onOpened);
    		if ("onClosed" in $$props) $$invalidate(15, onClosed = $$props.onClosed);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*show*/ 1048576) {
    			 {
    				if (isFunction(show)) {
    					open(show);
    				} else {
    					close();
    				}
    			}
    		}
    	};

    	return [
    		state,
    		Component,
    		background,
    		wrap,
    		modalWindow,
    		cssBg,
    		cssWindowWrap,
    		cssWindow,
    		cssContent,
    		cssCloseButton,
    		currentTransitionBg,
    		currentTransitionWindow,
    		onOpen,
    		onClose,
    		onOpened,
    		onClosed,
    		isFunction,
    		close,
    		handleKeydown,
    		handleOuterClick,
    		show,
    		key,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		setContext$1,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		$$scope,
    		slots,
    		div1_binding,
    		div2_binding,
    		div3_binding
    	];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				show: 20,
    				key: 21,
    				closeButton: 22,
    				closeOnEsc: 23,
    				closeOnOuterClick: 24,
    				styleBg: 25,
    				styleWindowWrap: 26,
    				styleWindow: 27,
    				styleContent: 28,
    				styleCloseButton: 29,
    				setContext: 30,
    				transitionBg: 31,
    				transitionBgProps: 32,
    				transitionWindow: 33,
    				transitionWindowProps: 34
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get show() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set show(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get key() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeButton() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeButton(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeOnEsc() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeOnEsc(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeOnOuterClick() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeOnOuterClick(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleBg() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleBg(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleWindowWrap() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleWindowWrap(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleWindow() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleWindow(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleContent() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleContent(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleCloseButton() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleCloseButton(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setContext() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set setContext(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionBg() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionBg(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionBgProps() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionBgProps(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionWindow() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionWindow(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionWindowProps() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionWindowProps(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Tips.svelte generated by Svelte v3.37.0 */

    const file$1 = "Tips.svelte";

    // (12:4) {#if large}
    function create_if_block$1(ctx) {
    	let li0;
    	let strong;
    	let t1;
    	let li1;

    	const block = {
    		c: function create() {
    			li0 = element("li");
    			strong = element("strong");
    			strong.textContent = "Do NOT make advanced payments unless you are 100% sure about their authenticity";
    			t1 = space();
    			li1 = element("li");
    			li1.textContent = "Check for replies under the tweets";
    			add_location(strong, file$1, 12, 10, 160);
    			add_location(li0, file$1, 12, 6, 156);
    			add_location(li1, file$1, 13, 6, 268);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li0, anchor);
    			append_dev(li0, strong);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, li1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(li1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(12:4) {#if large}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let h2;
    	let t1;
    	let ol;
    	let t2;
    	let li;
    	let t3;
    	let br;
    	let t4;
    	let img;
    	let img_src_value;
    	let if_block = /*large*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Tips";
    			t1 = space();
    			ol = element("ol");
    			if (if_block) if_block.c();
    			t2 = space();
    			li = element("li");
    			t3 = text("Make sure search results are sorted by \"Latest\"\n      ");
    			br = element("br");
    			t4 = space();
    			img = element("img");
    			attr_dev(h2, "class", "red svelte-1ej14rn");
    			add_location(h2, file$1, 9, 2, 101);
    			add_location(br, file$1, 17, 6, 391);
    			if (img.src !== (img_src_value = "click-here.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$1, 18, 6, 404);
    			add_location(li, file$1, 15, 4, 326);
    			add_location(ol, file$1, 10, 2, 129);
    			add_location(div, file$1, 8, 0, 93);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, ol);
    			if (if_block) if_block.m(ol, null);
    			append_dev(ol, t2);
    			append_dev(ol, li);
    			append_dev(li, t3);
    			append_dev(li, br);
    			append_dev(li, t4);
    			append_dev(li, img);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*large*/ ctx[0]) {
    				if (if_block) ; else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(ol, t2);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Tips", slots, []);
    	let { large = true } = $$props;
    	const writable_props = ["large"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tips> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("large" in $$props) $$invalidate(0, large = $$props.large);
    	};

    	$$self.$capture_state = () => ({ large });

    	$$self.$inject_state = $$props => {
    		if ("large" in $$props) $$invalidate(0, large = $$props.large);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [large];
    }

    class Tips extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { large: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tips",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get large() {
    		throw new Error("<Tips>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set large(value) {
    		throw new Error("<Tips>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const POPULAR_CITIES = [
      'delhi',
      'pune',
      'mumbai',
      'bangalore',
      'thane',
      'hyderabad',
      'nagpur',
      'lucknow',
      'ahmedabad',
      'chennai',
      'kolkata',
      'goa',
      'jaipur'
    ];

    function capitalCase(string) {
      if (!string) {
        return string;
      }

      return string[0].toUpperCase() + string.slice(1);
    }

    const STORAGE_KEY = {
      generated_links: 'generated_links',
    };

    const LocalStorage = {
      /**
       *
       * @param key
       * @param value
       * @returns {*}
       */
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch(e) {}

        return value;
      },

      /**
       *
       * @param key
       * @param defaultValue
       * @returns {any}
       */
      getItem: (key, defaultValue) => {
        try {
          const value = localStorage.getItem(key);
          if (value === null || typeof value === "undefined") {
            return defaultValue;
          }
          return JSON.parse(value);
        } catch (e) {}

        return defaultValue;
      },

      /**
       *
       * @param key
       */
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {}
      }
    };

    /* GeneratedLinks.svelte generated by Svelte v3.37.0 */
    const file$2 = "GeneratedLinks.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (30:2) {:else}
    function create_else_block$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Please enter a city name to generate links";
    			attr_dev(p, "class", "svelte-1taw8f0");
    			add_location(p, file$2, 30, 4, 540);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(30:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (23:2) {#if links.length > 0}
    function create_if_block$2(ctx) {
    	let p;
    	let t1;
    	let ol;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_value = /*links*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*link*/ ctx[1].href;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Click on city name to go to Twitter Search";
    			t1 = space();
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(p, "class", "svelte-1taw8f0");
    			add_location(p, file$2, 23, 4, 279);
    			attr_dev(ol, "id", "city-links");
    			attr_dev(ol, "class", "svelte-1taw8f0");
    			add_location(ol, file$2, 24, 4, 333);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, ol, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*links, capitalCase*/ 1) {
    				each_value = /*links*/ ctx[0];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, ol, destroy_block, create_each_block, null, get_each_context);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(ol);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(23:2) {#if links.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (26:6) {#each links as link (link.href)}
    function create_each_block(key_1, ctx) {
    	let li;
    	let a;
    	let t_value = capitalCase(/*link*/ ctx[1].city) + "";
    	let t;
    	let a_href_value;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[1].href);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "rel", "noopener noreferrer");
    			add_location(a, file$2, 26, 12, 406);
    			add_location(li, file$2, 26, 8, 402);
    			this.first = li;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*links*/ 1 && t_value !== (t_value = capitalCase(/*link*/ ctx[1].city) + "")) set_data_dev(t, t_value);

    			if (dirty & /*links*/ 1 && a_href_value !== (a_href_value = /*link*/ ctx[1].href)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(26:6) {#each links as link (link.href)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let h3;
    	let t1;

    	function select_block_type(ctx, dirty) {
    		if (/*links*/ ctx[0].length > 0) return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Your Generated Links";
    			t1 = space();
    			if_block.c();
    			attr_dev(h3, "class", "svelte-1taw8f0");
    			add_location(h3, file$2, 21, 2, 220);
    			add_location(div, file$2, 20, 0, 212);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("GeneratedLinks", slots, []);
    	let { links = [] } = $$props;
    	const writable_props = ["links"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<GeneratedLinks> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("links" in $$props) $$invalidate(0, links = $$props.links);
    	};

    	$$self.$capture_state = () => ({ links, capitalCase });

    	$$self.$inject_state = $$props => {
    		if ("links" in $$props) $$invalidate(0, links = $$props.links);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [links];
    }

    class GeneratedLinks extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { links: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GeneratedLinks",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get links() {
    		throw new Error("<GeneratedLinks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set links(value) {
    		throw new Error("<GeneratedLinks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* GeneratedLinksModal.svelte generated by Svelte v3.37.0 */

    function create_fragment$3(ctx) {
    	let tips;
    	let t;
    	let generatedlinks;
    	let current;
    	tips = new Tips({ props: { large: false }, $$inline: true });

    	generatedlinks = new GeneratedLinks({
    			props: { links: /*links*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tips.$$.fragment);
    			t = space();
    			create_component(generatedlinks.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tips, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(generatedlinks, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const generatedlinks_changes = {};
    			if (dirty & /*links*/ 1) generatedlinks_changes.links = /*links*/ ctx[0];
    			generatedlinks.$set(generatedlinks_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tips.$$.fragment, local);
    			transition_in(generatedlinks.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tips.$$.fragment, local);
    			transition_out(generatedlinks.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tips, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(generatedlinks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("GeneratedLinksModal", slots, []);
    	let { links } = $$props;
    	const writable_props = ["links"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<GeneratedLinksModal> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("links" in $$props) $$invalidate(0, links = $$props.links);
    	};

    	$$self.$capture_state = () => ({ GeneratedLinks, Tips, links });

    	$$self.$inject_state = $$props => {
    		if ("links" in $$props) $$invalidate(0, links = $$props.links);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [links];
    }

    class GeneratedLinksModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { links: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GeneratedLinksModal",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*links*/ ctx[0] === undefined && !("links" in props)) {
    			console.warn("<GeneratedLinksModal> was created without expected prop 'links'");
    		}
    	}

    	get links() {
    		throw new Error("<GeneratedLinksModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set links(value) {
    		throw new Error("<GeneratedLinksModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const modal = writable(null);

    /* App.svelte generated by Svelte v3.37.0 */

    const { Object: Object_1$1 } = globals;
    const file$3 = "App.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[24] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[24] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[29] = list[i];
    	child_ctx[30] = list;
    	child_ctx[31] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[29] = list[i];
    	child_ctx[32] = list;
    	child_ctx[33] = i;
    	return child_ctx;
    }

    // (293:4) {#if previouslySearched.length > 0}
    function create_if_block_1$1(ctx) {
    	let a;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "Previous Searches";
    			attr_dev(a, "href", "#previous-searches");
    			add_location(a, file$3, 293, 6, 6127);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(293:4) {#if previouslySearched.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (383:8) {#each Object.keys(alsoSearchFor) as item (item)}
    function create_each_block_3(key_1, ctx) {
    	let div;
    	let label;
    	let t0_value = capitalCase(/*item*/ ctx[29]) + "";
    	let t0;
    	let t1;
    	let input;
    	let input_id_value;
    	let t2;
    	let span;
    	let label_for_value;
    	let t3;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[10].call(input, /*item*/ ctx[29]);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			span = element("span");
    			t3 = space();
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "id", input_id_value = `alsoSearchFor-${/*item*/ ctx[29]}`);
    			attr_dev(input, "class", "svelte-12utd5v");
    			add_location(input, file$3, 385, 14, 8633);
    			attr_dev(span, "class", "checkmark");
    			add_location(span, file$3, 386, 14, 8745);
    			attr_dev(label, "class", "container svelte-12utd5v");
    			attr_dev(label, "for", label_for_value = `alsoSearchFor-${/*item*/ ctx[29]}`);
    			add_location(label, file$3, 384, 12, 8544);
    			attr_dev(div, "class", "svelte-12utd5v");
    			add_location(div, file$3, 383, 10, 8526);
    			this.first = div;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, label);
    			append_dev(label, t0);
    			append_dev(label, t1);
    			append_dev(label, input);
    			input.checked = /*alsoSearchFor*/ ctx[2][/*item*/ ctx[29]].checked;
    			append_dev(label, t2);
    			append_dev(label, span);
    			append_dev(div, t3);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", input_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*alsoSearchFor*/ 4 && t0_value !== (t0_value = capitalCase(/*item*/ ctx[29]) + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*alsoSearchFor*/ 4 && input_id_value !== (input_id_value = `alsoSearchFor-${/*item*/ ctx[29]}`)) {
    				attr_dev(input, "id", input_id_value);
    			}

    			if (dirty[0] & /*alsoSearchFor*/ 4) {
    				input.checked = /*alsoSearchFor*/ ctx[2][/*item*/ ctx[29]].checked;
    			}

    			if (dirty[0] & /*alsoSearchFor*/ 4 && label_for_value !== (label_for_value = `alsoSearchFor-${/*item*/ ctx[29]}`)) {
    				attr_dev(label, "for", label_for_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(383:8) {#each Object.keys(alsoSearchFor) as item (item)}",
    		ctx
    	});

    	return block;
    }

    // (429:12) {#each Object.keys(excludeKeywords) as item (item)}
    function create_each_block_2(key_1, ctx) {
    	let div;
    	let input;
    	let input_id_value;
    	let t0;
    	let label;
    	let t1_value = /*item*/ ctx[29] + "";
    	let t1;
    	let t2;
    	let label_for_value;
    	let mounted;
    	let dispose;

    	function input_change_handler_1() {
    		/*input_change_handler_1*/ ctx[14].call(input, /*item*/ ctx[29]);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			t1 = text(t1_value);
    			t2 = text(" (and its variants)");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "id", input_id_value = `excludeKeywords-${/*item*/ ctx[29]}`);
    			attr_dev(input, "class", "svelte-12utd5v");
    			add_location(input, file$3, 430, 16, 10159);
    			attr_dev(label, "for", label_for_value = `excludeKeywords-${/*item*/ ctx[29]}`);
    			add_location(label, file$3, 431, 16, 10277);
    			add_location(div, file$3, 429, 14, 10137);
    			this.first = div;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			input.checked = /*excludeKeywords*/ ctx[3][/*item*/ ctx[29]].checked;
    			append_dev(div, t0);
    			append_dev(div, label);
    			append_dev(label, t1);
    			append_dev(label, t2);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", input_change_handler_1);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*excludeKeywords*/ 8 && input_id_value !== (input_id_value = `excludeKeywords-${/*item*/ ctx[29]}`)) {
    				attr_dev(input, "id", input_id_value);
    			}

    			if (dirty[0] & /*excludeKeywords*/ 8) {
    				input.checked = /*excludeKeywords*/ ctx[3][/*item*/ ctx[29]].checked;
    			}

    			if (dirty[0] & /*excludeKeywords*/ 8 && t1_value !== (t1_value = /*item*/ ctx[29] + "")) set_data_dev(t1, t1_value);

    			if (dirty[0] & /*excludeKeywords*/ 8 && label_for_value !== (label_for_value = `excludeKeywords-${/*item*/ ctx[29]}`)) {
    				attr_dev(label, "for", label_for_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(429:12) {#each Object.keys(excludeKeywords) as item (item)}",
    		ctx
    	});

    	return block;
    }

    // (464:6) {#each popularCityLinks as link (link.href)}
    function create_each_block_1(key_1, ctx) {
    	let li;
    	let a;
    	let t_value = capitalCase(/*link*/ ctx[24].city) + "";
    	let t;
    	let a_href_value;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[24].href);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "rel", "noopener noreferrer");
    			add_location(a, file$3, 464, 12, 11200);
    			add_location(li, file$3, 464, 8, 11196);
    			this.first = li;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*popularCityLinks*/ 32 && t_value !== (t_value = capitalCase(/*link*/ ctx[24].city) + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*popularCityLinks*/ 32 && a_href_value !== (a_href_value = /*link*/ ctx[24].href)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(464:6) {#each popularCityLinks as link (link.href)}",
    		ctx
    	});

    	return block;
    }

    // (471:2) {#if previouslySearched.length > 0}
    function create_if_block$3(ctx) {
    	let hr;
    	let t0;
    	let div;
    	let h2;
    	let t2;
    	let ol;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t3;
    	let button;
    	let t5;
    	let br;
    	let mounted;
    	let dispose;
    	let each_value = /*previouslySearched*/ ctx[4];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*link*/ ctx[24].href;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			hr = element("hr");
    			t0 = space();
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Previous Searches";
    			t2 = space();
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			button = element("button");
    			button.textContent = "Clear Previous Searches";
    			t5 = space();
    			br = element("br");
    			attr_dev(hr, "class", "svelte-12utd5v");
    			add_location(hr, file$3, 471, 4, 11375);
    			add_location(h2, file$3, 473, 6, 11421);
    			attr_dev(ol, "class", "split-three-two svelte-12utd5v");
    			add_location(ol, file$3, 475, 6, 11455);
    			attr_dev(button, "class", "mycolourred svelte-12utd5v");
    			attr_dev(button, "id", "clear");
    			add_location(button, file$3, 481, 6, 11684);
    			attr_dev(div, "id", "previous-searches");
    			add_location(div, file$3, 472, 4, 11386);
    			add_location(br, file$3, 484, 4, 11814);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, hr, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(div, t2);
    			append_dev(div, ol);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}

    			append_dev(div, t3);
    			append_dev(div, button);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*clearSavedLinks*/ ctx[8]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*previouslySearched*/ 16) {
    				each_value = /*previouslySearched*/ ctx[4];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, ol, destroy_block, create_each_block$1, null, get_each_context$1);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(hr);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(471:2) {#if previouslySearched.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (477:8) {#each previouslySearched as link (link.href)}
    function create_each_block$1(key_1, ctx) {
    	let li;
    	let a;
    	let t_value = capitalCase(/*link*/ ctx[24].city) + "";
    	let t;
    	let a_href_value;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[24].href);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "rel", "noopener noreferrer");
    			add_location(a, file$3, 477, 14, 11553);
    			add_location(li, file$3, 477, 10, 11549);
    			this.first = li;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*previouslySearched*/ 16 && t_value !== (t_value = capitalCase(/*link*/ ctx[24].city) + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*previouslySearched*/ 16 && a_href_value !== (a_href_value = /*link*/ ctx[24].href)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(477:8) {#each previouslySearched as link (link.href)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let main;
    	let br0;
    	let t0;
    	let br1;
    	let t1;
    	let nav;
    	let a;
    	let t3;
    	let t4;
    	let hr0;
    	let t5;
    	let tips;
    	let t6;
    	let hr1;
    	let t7;
    	let div11;
    	let h20;
    	let t9;
    	let form;
    	let div0;
    	let label0;
    	let t11;
    	let br2;
    	let t12;
    	let input0;
    	let t13;
    	let style;
    	let t15;
    	let div1;
    	let each_blocks_2 = [];
    	let each0_lookup = new Map();
    	let t16;
    	let div2;
    	let label1;
    	let t18;
    	let input1;
    	let t19;
    	let div3;
    	let button;
    	let t21;
    	let hr2;
    	let t22;
    	let div10;
    	let div9;
    	let div4;
    	let input2;
    	let t23;
    	let label2;
    	let t24;
    	let br3;
    	let t25;
    	let strong0;
    	let t27;
    	let br4;
    	let t28;
    	let t29;
    	let div5;
    	let input3;
    	let t30;
    	let label3;
    	let t31;
    	let br5;
    	let t32;
    	let t33;
    	let div7;
    	let t34;
    	let strong1;
    	let t36;
    	let each_blocks_1 = [];
    	let each1_lookup = new Map();
    	let t37;
    	let div6;
    	let label4;
    	let t39;
    	let input4;
    	let t40;
    	let div8;
    	let input5;
    	let t41;
    	let label5;
    	let t43;
    	let modal_1;
    	let t44;
    	let hr3;
    	let t45;
    	let div12;
    	let h21;
    	let t47;
    	let ol;
    	let each_blocks = [];
    	let each2_lookup = new Map();
    	let t48;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*previouslySearched*/ ctx[4].length > 0 && create_if_block_1$1(ctx);
    	tips = new Tips({ $$inline: true });
    	let each_value_3 = Object.keys(/*alsoSearchFor*/ ctx[2]);
    	validate_each_argument(each_value_3);
    	const get_key = ctx => /*item*/ ctx[29];
    	validate_each_keys(ctx, each_value_3, get_each_context_3, get_key);

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		let child_ctx = get_each_context_3(ctx, each_value_3, i);
    		let key = get_key(child_ctx);
    		each0_lookup.set(key, each_blocks_2[i] = create_each_block_3(key, child_ctx));
    	}

    	let each_value_2 = Object.keys(/*excludeKeywords*/ ctx[3]);
    	validate_each_argument(each_value_2);
    	const get_key_1 = ctx => /*item*/ ctx[29];
    	validate_each_keys(ctx, each_value_2, get_each_context_2, get_key_1);

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		let child_ctx = get_each_context_2(ctx, each_value_2, i);
    		let key = get_key_1(child_ctx);
    		each1_lookup.set(key, each_blocks_1[i] = create_each_block_2(key, child_ctx));
    	}

    	modal_1 = new Modal({
    			props: {
    				show: /*$modal*/ ctx[6],
    				transitionBgProps: { duration: 0 },
    				transitionWindowProps: { duration: 0 }
    			},
    			$$inline: true
    		});

    	let each_value_1 = /*popularCityLinks*/ ctx[5];
    	validate_each_argument(each_value_1);
    	const get_key_2 = ctx => /*link*/ ctx[24].href;
    	validate_each_keys(ctx, each_value_1, get_each_context_1, get_key_2);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key_2(child_ctx);
    		each2_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	let if_block1 = /*previouslySearched*/ ctx[4].length > 0 && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			br0 = element("br");
    			t0 = space();
    			br1 = element("br");
    			t1 = space();
    			nav = element("nav");
    			a = element("a");
    			a.textContent = "Frequently Searched Cities";
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			hr0 = element("hr");
    			t5 = space();
    			create_component(tips.$$.fragment);
    			t6 = space();
    			hr1 = element("hr");
    			t7 = space();
    			div11 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Search";
    			t9 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Name of city";
    			t11 = space();
    			br2 = element("br");
    			t12 = space();
    			input0 = element("input");
    			t13 = space();
    			style = element("style");
    			style.textContent = "/* The container */\n        .container {\n          display: block;\n          position: relative;\n          padding-left: 35px;\n          margin-bottom: 12px;\n          cursor: pointer;\n          font-size: 22px;\n          -webkit-user-select: none;\n          -moz-user-select: none;\n          -ms-user-select: none;\n          user-select: none;\n        }\n        \n        /* Hide the browser's default checkbox */\n        .container input {\n          position: absolute;\n          opacity: 0;\n          cursor: pointer;\n          height: 0;\n          width: 0;\n        }\n        \n        /* Create a custom checkbox */\n        .checkmark {\n          position: absolute;\n          top: 0;\n          left: 0;\n          height: 25px;\n          width: 25px;\n          background-color: #eee;\n        }\n        \n        /* On mouse-over, add a grey background color */\n        .container:hover input ~ .checkmark {\n          background-color: #ccc;\n        }\n        \n        /* When the checkbox is checked, add a blue background */\n        .container input:checked ~ .checkmark {\n          background-color: #2196F3;\n        }\n        \n        /* Create the checkmark/indicator (hidden when not checked) */\n        .checkmark:after {\n          content: \"\";\n          position: absolute;\n          display: none;\n        }\n        \n        /* Show the checkmark when checked */\n        .container input:checked ~ .checkmark:after {\n          display: block;\n        }\n        \n        /* Style the checkmark/indicator */\n        .container .checkmark:after {\n          left: 9px;\n          top: 5px;\n          width: 5px;\n          height: 10px;\n          border: solid white;\n          border-width: 0 3px 3px 0;\n          -webkit-transform: rotate(45deg);\n          -ms-transform: rotate(45deg);\n          transform: rotate(45deg);\n        }";
    			t15 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t16 = space();
    			div2 = element("div");
    			label1 = element("label");
    			label1.textContent = "Other:";
    			t18 = space();
    			input1 = element("input");
    			t19 = space();
    			div3 = element("div");
    			button = element("button");
    			button.textContent = "Search or Generate Links";
    			t21 = space();
    			hr2 = element("hr");
    			t22 = space();
    			div10 = element("div");
    			div9 = element("div");
    			div4 = element("div");
    			input2 = element("input");
    			t23 = space();
    			label2 = element("label");
    			t24 = text("Show verified tweets only\n              ");
    			br3 = element("br");
    			t25 = space();
    			strong0 = element("strong");
    			strong0.textContent = "Uncheck this for smaller cities";
    			t27 = space();
    			br4 = element("br");
    			t28 = text("\n              (Tweet should contain \"verified\")");
    			t29 = space();
    			div5 = element("div");
    			input3 = element("input");
    			t30 = space();
    			label3 = element("label");
    			t31 = text("Exclude unverified tweets\n              ");
    			br5 = element("br");
    			t32 = text("\n              (Tweet should not contain \"not verified\" and \"unverified\")");
    			t33 = space();
    			div7 = element("div");
    			t34 = text("Tweets should ");
    			strong1 = element("strong");
    			strong1.textContent = "NOT";
    			t36 = text(" have these words:\n      \n            ");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t37 = space();
    			div6 = element("div");
    			label4 = element("label");
    			label4.textContent = "Other:";
    			t39 = space();
    			input4 = element("input");
    			t40 = space();
    			div8 = element("div");
    			input5 = element("input");
    			t41 = space();
    			label5 = element("label");
    			label5.textContent = "Show Tweets near me";
    			t43 = space();
    			create_component(modal_1.$$.fragment);
    			t44 = space();
    			hr3 = element("hr");
    			t45 = space();
    			div12 = element("div");
    			h21 = element("h2");
    			h21.textContent = "Frequently Searched Cities";
    			t47 = space();
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t48 = space();
    			if (if_block1) if_block1.c();
    			add_location(br0, file$3, 287, 2, 5972);
    			add_location(br1, file$3, 288, 2, 5981);
    			attr_dev(a, "href", "#frequent-searches");
    			add_location(a, file$3, 291, 4, 6021);
    			attr_dev(nav, "class", "split-two-one svelte-12utd5v");
    			add_location(nav, file$3, 290, 2, 5989);
    			attr_dev(hr0, "class", "svelte-12utd5v");
    			add_location(hr0, file$3, 297, 2, 6202);
    			attr_dev(hr1, "class", "svelte-12utd5v");
    			add_location(hr1, file$3, 301, 2, 6224);
    			set_style(h20, "color", "green");
    			add_location(h20, file$3, 304, 4, 6244);
    			attr_dev(label0, "for", "cities");
    			add_location(label0, file$3, 308, 8, 6354);
    			add_location(br2, file$3, 309, 8, 6403);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "cities");
    			attr_dev(input0, "placeholder", "Enter city name here");
    			attr_dev(input0, "class", "svelte-12utd5v");
    			add_location(input0, file$3, 310, 8, 6418);
    			add_location(div0, file$3, 307, 6, 6340);
    			add_location(style, file$3, 312, 6, 6533);
    			attr_dev(div1, "class", "split-three-two checkbox-fields svelte-12utd5v");
    			add_location(div1, file$3, 381, 6, 8412);
    			attr_dev(label1, "for", "alsoSearchFor-other");
    			add_location(label1, file$3, 393, 8, 8885);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "alsoSearchFor-other");
    			add_location(input1, file$3, 394, 8, 8941);
    			attr_dev(div2, "class", "other-input svelte-12utd5v");
    			add_location(div2, file$3, 392, 6, 8851);
    			attr_dev(button, "class", "mycolourblue svelte-12utd5v");
    			add_location(button, file$3, 398, 8, 9092);
    			attr_dev(div3, "id", "generate-button-container");
    			attr_dev(div3, "class", "svelte-12utd5v");
    			add_location(div3, file$3, 397, 6, 9047);
    			attr_dev(hr2, "class", "svelte-12utd5v");
    			add_location(hr2, file$3, 401, 6, 9175);
    			attr_dev(input2, "type", "checkbox");
    			attr_dev(input2, "id", "verifiedOnly");
    			add_location(input2, file$3, 406, 12, 9279);
    			add_location(br3, file$3, 409, 14, 9455);
    			add_location(strong0, file$3, 410, 14, 9476);
    			add_location(br4, file$3, 411, 14, 9539);
    			attr_dev(label2, "for", "verifiedOnly");
    			add_location(label2, file$3, 407, 12, 9374);
    			attr_dev(div4, "class", "svelte-12utd5v");
    			add_location(div4, file$3, 405, 10, 9261);
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "id", "excludeUnverified");
    			add_location(input3, file$3, 417, 12, 9661);
    			add_location(br5, file$3, 420, 14, 9852);
    			attr_dev(label3, "for", "excludeUnverified");
    			add_location(label3, file$3, 418, 12, 9766);
    			attr_dev(div5, "class", "svelte-12utd5v");
    			add_location(div5, file$3, 416, 10, 9643);
    			add_location(strong1, file$3, 426, 26, 10013);
    			attr_dev(label4, "for", "excludeKeywords-other");
    			add_location(label4, file$3, 436, 14, 10450);
    			attr_dev(input4, "type", "text");
    			attr_dev(input4, "id", "excludeKeywords-other");
    			add_location(input4, file$3, 437, 14, 10514);
    			attr_dev(div6, "class", "other-input svelte-12utd5v");
    			add_location(div6, file$3, 435, 12, 10410);
    			attr_dev(div7, "class", "svelte-12utd5v");
    			add_location(div7, file$3, 425, 10, 9981);
    			attr_dev(input5, "type", "checkbox");
    			attr_dev(input5, "id", "nearMe");
    			add_location(input5, file$3, 442, 12, 10676);
    			attr_dev(label5, "for", "nearMe");
    			add_location(label5, file$3, 443, 12, 10759);
    			attr_dev(div8, "class", "svelte-12utd5v");
    			add_location(div8, file$3, 441, 10, 10658);
    			attr_dev(div9, "class", "split-two-one spaced svelte-12utd5v");
    			add_location(div9, file$3, 404, 8, 9216);
    			attr_dev(div10, "id", "options");
    			attr_dev(div10, "class", "svelte-12utd5v");
    			add_location(div10, file$3, 403, 6, 9189);
    			add_location(form, file$3, 306, 4, 6291);
    			add_location(div11, file$3, 303, 2, 6234);
    			attr_dev(hr3, "class", "svelte-12utd5v");
    			add_location(hr3, file$3, 453, 2, 10986);
    			add_location(h21, file$3, 460, 4, 11067);
    			attr_dev(ol, "class", "split-three-two svelte-12utd5v");
    			add_location(ol, file$3, 462, 4, 11108);
    			attr_dev(div12, "id", "frequent-searches");
    			add_location(div12, file$3, 459, 2, 11034);
    			add_location(main, file$3, 284, 0, 5918);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, br0);
    			append_dev(main, t0);
    			append_dev(main, br1);
    			append_dev(main, t1);
    			append_dev(main, nav);
    			append_dev(nav, a);
    			append_dev(nav, t3);
    			if (if_block0) if_block0.m(nav, null);
    			append_dev(main, t4);
    			append_dev(main, hr0);
    			append_dev(main, t5);
    			mount_component(tips, main, null);
    			append_dev(main, t6);
    			append_dev(main, hr1);
    			append_dev(main, t7);
    			append_dev(main, div11);
    			append_dev(div11, h20);
    			append_dev(div11, t9);
    			append_dev(div11, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t11);
    			append_dev(div0, br2);
    			append_dev(div0, t12);
    			append_dev(div0, input0);
    			set_input_value(input0, /*inputs*/ ctx[0].cities);
    			append_dev(form, t13);
    			append_dev(form, style);
    			append_dev(form, t15);
    			append_dev(form, div1);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div1, null);
    			}

    			append_dev(form, t16);
    			append_dev(form, div2);
    			append_dev(div2, label1);
    			append_dev(div2, t18);
    			append_dev(div2, input1);
    			set_input_value(input1, /*inputs*/ ctx[0].otherAlsoSearchFor);
    			append_dev(form, t19);
    			append_dev(form, div3);
    			append_dev(div3, button);
    			append_dev(form, t21);
    			append_dev(form, hr2);
    			append_dev(form, t22);
    			append_dev(form, div10);
    			append_dev(div10, div9);
    			append_dev(div9, div4);
    			append_dev(div4, input2);
    			input2.checked = /*checkboxes*/ ctx[1].verifiedOnly;
    			append_dev(div4, t23);
    			append_dev(div4, label2);
    			append_dev(label2, t24);
    			append_dev(label2, br3);
    			append_dev(label2, t25);
    			append_dev(label2, strong0);
    			append_dev(label2, t27);
    			append_dev(label2, br4);
    			append_dev(label2, t28);
    			append_dev(div9, t29);
    			append_dev(div9, div5);
    			append_dev(div5, input3);
    			input3.checked = /*checkboxes*/ ctx[1].excludeUnverified;
    			append_dev(div5, t30);
    			append_dev(div5, label3);
    			append_dev(label3, t31);
    			append_dev(label3, br5);
    			append_dev(label3, t32);
    			append_dev(div9, t33);
    			append_dev(div9, div7);
    			append_dev(div7, t34);
    			append_dev(div7, strong1);
    			append_dev(div7, t36);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div7, null);
    			}

    			append_dev(div7, t37);
    			append_dev(div7, div6);
    			append_dev(div6, label4);
    			append_dev(div6, t39);
    			append_dev(div6, input4);
    			set_input_value(input4, /*inputs*/ ctx[0].otherExcludedKeywords);
    			append_dev(div9, t40);
    			append_dev(div9, div8);
    			append_dev(div8, input5);
    			input5.checked = /*checkboxes*/ ctx[1].nearMe;
    			append_dev(div8, t41);
    			append_dev(div8, label5);
    			append_dev(div11, t43);
    			mount_component(modal_1, div11, null);
    			append_dev(main, t44);
    			append_dev(main, hr3);
    			append_dev(main, t45);
    			append_dev(main, div12);
    			append_dev(div12, h21);
    			append_dev(div12, t47);
    			append_dev(div12, ol);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}

    			append_dev(main, t48);
    			if (if_block1) if_block1.m(main, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[11]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[12]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[13]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[15]),
    					listen_dev(input5, "change", /*input5_change_handler*/ ctx[16]),
    					listen_dev(form, "submit", prevent_default(/*generate*/ ctx[7]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*previouslySearched*/ ctx[4].length > 0) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_1$1(ctx);
    					if_block0.c();
    					if_block0.m(nav, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty[0] & /*inputs*/ 1 && input0.value !== /*inputs*/ ctx[0].cities) {
    				set_input_value(input0, /*inputs*/ ctx[0].cities);
    			}

    			if (dirty[0] & /*alsoSearchFor*/ 4) {
    				each_value_3 = Object.keys(/*alsoSearchFor*/ ctx[2]);
    				validate_each_argument(each_value_3);
    				validate_each_keys(ctx, each_value_3, get_each_context_3, get_key);
    				each_blocks_2 = update_keyed_each(each_blocks_2, dirty, get_key, 1, ctx, each_value_3, each0_lookup, div1, destroy_block, create_each_block_3, null, get_each_context_3);
    			}

    			if (dirty[0] & /*inputs*/ 1 && input1.value !== /*inputs*/ ctx[0].otherAlsoSearchFor) {
    				set_input_value(input1, /*inputs*/ ctx[0].otherAlsoSearchFor);
    			}

    			if (dirty[0] & /*checkboxes*/ 2) {
    				input2.checked = /*checkboxes*/ ctx[1].verifiedOnly;
    			}

    			if (dirty[0] & /*checkboxes*/ 2) {
    				input3.checked = /*checkboxes*/ ctx[1].excludeUnverified;
    			}

    			if (dirty[0] & /*excludeKeywords*/ 8) {
    				each_value_2 = Object.keys(/*excludeKeywords*/ ctx[3]);
    				validate_each_argument(each_value_2);
    				validate_each_keys(ctx, each_value_2, get_each_context_2, get_key_1);
    				each_blocks_1 = update_keyed_each(each_blocks_1, dirty, get_key_1, 1, ctx, each_value_2, each1_lookup, div7, destroy_block, create_each_block_2, t37, get_each_context_2);
    			}

    			if (dirty[0] & /*inputs*/ 1 && input4.value !== /*inputs*/ ctx[0].otherExcludedKeywords) {
    				set_input_value(input4, /*inputs*/ ctx[0].otherExcludedKeywords);
    			}

    			if (dirty[0] & /*checkboxes*/ 2) {
    				input5.checked = /*checkboxes*/ ctx[1].nearMe;
    			}

    			const modal_1_changes = {};
    			if (dirty[0] & /*$modal*/ 64) modal_1_changes.show = /*$modal*/ ctx[6];
    			modal_1.$set(modal_1_changes);

    			if (dirty[0] & /*popularCityLinks*/ 32) {
    				each_value_1 = /*popularCityLinks*/ ctx[5];
    				validate_each_argument(each_value_1);
    				validate_each_keys(ctx, each_value_1, get_each_context_1, get_key_2);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key_2, 1, ctx, each_value_1, each2_lookup, ol, destroy_block, create_each_block_1, null, get_each_context_1);
    			}

    			if (/*previouslySearched*/ ctx[4].length > 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$3(ctx);
    					if_block1.c();
    					if_block1.m(main, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tips.$$.fragment, local);
    			transition_in(modal_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tips.$$.fragment, local);
    			transition_out(modal_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			destroy_component(tips);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].d();
    			}

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].d();
    			}

    			destroy_component(modal_1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (if_block1) if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $modal;
    	validate_store(modal, "modal");
    	component_subscribe($$self, modal, $$value => $$invalidate(6, $modal = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	const inputs = {
    		cities: "",
    		otherAlsoSearchFor: "",
    		otherExcludedKeywords: ""
    	};

    	const checkboxes = {
    		nearMe: false,
    		verifiedOnly: true,
    		excludeUnverified: true
    	};

    	const alsoSearchFor = {
    		beds: { keywords: ["bed", "beds"], checked: true },
    		ICU: { keywords: ["icu"], checked: true },
    		oxygen: { keywords: ["oxygen"], checked: true },
    		ventilator: {
    			keywords: ["ventilator", "ventilators"],
    			checked: true
    		},
    		tests: {
    			keywords: ["test", "tests", "testing"],
    			checked: false
    		},
    		fabiflu: { keywords: ["fabiflu"], checked: false },
    		remdesivir: { keywords: ["remdesivir"], checked: false },
    		favipiravir: {
    			keywords: ["favipiravir"],
    			checked: false
    		},
    		tocilizumab: {
    			keywords: ["tocilizumab"],
    			checked: false
    		},
    		plasma: { keywords: ["plasma"], checked: false },
    		food: {
    			keywords: ["tiffin", "food"],
    			checked: false
    		},
    		ambulance: { keywords: ["ambulance"], checked: false },
    		"amphotericin B": {
    			keywords: ["amphotericin b", "amphotericin"],
    			checked: false
    		}
    	};

    	const excludeKeywords = {
    		needed: {
    			keywords: ["needed", "need", "needs"],
    			checked: true
    		},
    		required: {
    			keywords: ["required", "require", "requires", "requirement", "requirements"],
    			checked: true
    		}
    	};

    	let links = [];
    	let previouslySearched = LocalStorage.getItem(STORAGE_KEY.generated_links, []);
    	let popularCityLinks = [];

    	function getAlsoSearchForString() {
    		const keywords = Object.keys(alsoSearchFor).reduce(
    			(keywordsSoFar, item) => {
    				if (alsoSearchFor[item].checked) {
    					return keywordsSoFar.concat(alsoSearchFor[item].keywords);
    				} else {
    					return keywordsSoFar;
    				}
    			},
    			[]
    		);

    		if (inputs.otherAlsoSearchFor) {
    			keywords.push(inputs.otherAlsoSearchFor);
    		}

    		if (keywords.length > 0) {
    			return `(${keywords.join(" OR ")})`;
    		} else {
    			return "";
    		}
    	}

    	function getExcludedKeywordsString() {
    		const keywords = Object.keys(excludeKeywords).reduce(
    			(keywordsSoFar, item) => {
    				if (excludeKeywords[item].checked) {
    					return keywordsSoFar.concat(excludeKeywords[item].keywords);
    				} else {
    					return keywordsSoFar;
    				}
    			},
    			[]
    		);

    		if (inputs.otherExcludedKeywords) {
    			keywords.push(inputs.otherExcludedKeywords);
    		}

    		return keywords.map(keyword => `-"${keyword}"`).join(" ");
    	}

    	function generateCityLinkObject(city) {
    		return { city, href: generateLinkForCity(city) };
    	}

    	function generateLinkForCity(city) {
    		const base = `https://twitter.com/search`;
    		const params = new URLSearchParams();

    		const query = [
    			checkboxes.verifiedOnly && "verified",
    			city.trim(),
    			getAlsoSearchForString(),
    			checkboxes.excludeUnverified && "-\"not verified\"",
    			checkboxes.excludeUnverified && "-\"unverified\"",
    			getExcludedKeywordsString()
    		].filter(Boolean).join(" ");

    		params.set("q", query);
    		params.set("f", "live");

    		if (checkboxes.nearMe) {
    			params.set("lf", "on");
    		}

    		const link = `${base}?${params.toString()}`;
    		return link;
    	}

    	function generateLinks() {
    		if (!inputs.cities) {
    			links = [];
    			return;
    		}

    		const cities = inputs.cities.split(",").map(city => city.trim()).filter(Boolean);
    		links = cities.map(generateCityLinkObject);
    	}

    	function generatePopularCityLinks() {
    		$$invalidate(5, popularCityLinks = POPULAR_CITIES.map(generateCityLinkObject));
    	}

    	function generate() {
    		if (!inputs.cities) {
    			alert("Please enter city name");
    			return;
    		}

    		modal.set(bind(GeneratedLinksModal, { links }));
    		LocalStorage.setItem(STORAGE_KEY.generated_links, links);
    	}

    	function clearSavedLinks() {
    		$$invalidate(4, previouslySearched = []);
    		LocalStorage.removeItem(STORAGE_KEY.generated_links);
    	}

    	const writable_props = [];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		inputs.cities = this.value;
    		$$invalidate(0, inputs);
    	}

    	function input_change_handler(item) {
    		alsoSearchFor[item].checked = this.checked;
    		$$invalidate(2, alsoSearchFor);
    	}

    	function input1_input_handler() {
    		inputs.otherAlsoSearchFor = this.value;
    		$$invalidate(0, inputs);
    	}

    	function input2_change_handler() {
    		checkboxes.verifiedOnly = this.checked;
    		$$invalidate(1, checkboxes);
    	}

    	function input3_change_handler() {
    		checkboxes.excludeUnverified = this.checked;
    		$$invalidate(1, checkboxes);
    	}

    	function input_change_handler_1(item) {
    		excludeKeywords[item].checked = this.checked;
    		$$invalidate(3, excludeKeywords);
    	}

    	function input4_input_handler() {
    		inputs.otherExcludedKeywords = this.value;
    		$$invalidate(0, inputs);
    	}

    	function input5_change_handler() {
    		checkboxes.nearMe = this.checked;
    		$$invalidate(1, checkboxes);
    	}

    	$$self.$capture_state = () => ({
    		Modal,
    		bind,
    		Tips,
    		GeneratedLinksModal,
    		POPULAR_CITIES,
    		STORAGE_KEY,
    		LocalStorage,
    		capitalCase,
    		modal,
    		inputs,
    		checkboxes,
    		alsoSearchFor,
    		excludeKeywords,
    		links,
    		previouslySearched,
    		popularCityLinks,
    		getAlsoSearchForString,
    		getExcludedKeywordsString,
    		generateCityLinkObject,
    		generateLinkForCity,
    		generateLinks,
    		generatePopularCityLinks,
    		generate,
    		clearSavedLinks,
    		$modal
    	});

    	$$self.$inject_state = $$props => {
    		if ("links" in $$props) links = $$props.links;
    		if ("previouslySearched" in $$props) $$invalidate(4, previouslySearched = $$props.previouslySearched);
    		if ("popularCityLinks" in $$props) $$invalidate(5, popularCityLinks = $$props.popularCityLinks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*alsoSearchFor, inputs, checkboxes, excludeKeywords*/ 15) {
    			 (generateLinks());
    		}

    		if ($$self.$$.dirty[0] & /*alsoSearchFor, inputs, checkboxes, excludeKeywords*/ 15) {
    			 (generatePopularCityLinks());
    		}
    	};

    	return [
    		inputs,
    		checkboxes,
    		alsoSearchFor,
    		excludeKeywords,
    		previouslySearched,
    		popularCityLinks,
    		$modal,
    		generate,
    		clearSavedLinks,
    		input0_input_handler,
    		input_change_handler,
    		input1_input_handler,
    		input2_change_handler,
    		input3_change_handler,
    		input_change_handler_1,
    		input4_input_handler,
    		input5_change_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {}, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
