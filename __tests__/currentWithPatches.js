"use strict"
import {
	createDraft,
	current,
	currentWithPatches,
	enableAllPlugins,
	immerable,
	isDraft,
	produce,
	setAutoFreeze,
	setUseProxies
} from "../src/immer"

enableAllPlugins()

runTests("proxy", true)
runTests("es5", false)

const isProd = process.env.NODE_ENV === "production"

function runTests(name, useProxies) {
	describe("currentWithPatches - " + name, () => {
		beforeAll(() => {
			setAutoFreeze(true)
			setUseProxies(useProxies)
		})

		it("只能用 Draft 作参数", () => {
			expect(() => currentWithPatches({})).toThrowErrorMatchingSnapshot()
		})

		it("生成 patches", () => {
			const draft = createDraft({x: 3})
			draft.x++
			const [, patches] = currentWithPatches(draft)
			expect(patches).toStrictEqual([{op: "replace", path: ["x"], value: 4}])
		})

		it("数组", () => {
			const draft = createDraft([{x: 1}])
			draft[0].x++
			const [, patches] = currentWithPatches(draft)
			expect(patches).toStrictEqual([{op: "replace", path: [0, "x"], value: 2}])
		})

		it("可以多次调用", () => {})

		it("不能影响 finishDraft", () => {})

		it("基于上次调用时的状态生成 patches", () => {})

		it("can handle property additions", () => {
			const base = {}
			produce(base, draft => {
				draft.x = true
				const [result, patches] = currentWithPatches(draft)
				expect(patches).toEqual([{op: "add", path: ["x"], value: true}])
				expect(result).not.toBe(base)
				expect(result).not.toBe(draft)
				expect(result).toEqual({
					x: true
				})
			})
		})

		it("can handle property deletions", () => {
			const base = {
				x: 1
			}
			produce(base, draft => {
				delete draft.x
				const [result, patches] = currentWithPatches(draft)
				expect(patches).toEqual([{op: "remove", path: ["x"]}])
				expect(result).not.toBe(base)
				expect(result).not.toBe(draft)
				expect(result).toEqual({})
			})
		})

		it("won't reflect changes over time", () => {
			const base = {x: 1}
			produce(base, draft => {
				draft.x++
				const [result, patches] = currentWithPatches(draft)
				expect(patches).toEqual([{op: "replace", path: ["x"], value: 2}])
				expect(result).toEqual({x: 2})
				draft.x++
				expect(result).toEqual({x: 2})
			})
		})

		it("will find drafts inside objects", () => {
			const base = {x: 1, y: {z: 2}, z: {}}
			produce(base, draft => {
				draft.y.z++
				draft.y = {nested: draft.y}
				const [result, patches] = currentWithPatches(draft)
				expect(patches).toEqual([
					{op: "replace", path: ["y"], value: {nested: {z: 3}}},
					{op: "replace", path: ["y", "nested", "z"], value: 3}
				])
				expect(result).toEqual({x: 1, y: {nested: {z: 3}}, z: {}})
				expect(isDraft(result.y.nested)).toBe(false)
				expect(result.z).toBe(base.z)
				expect(result.y.nested).not.toBe(draft.y.nested)
			})
		})

		it("handles map - 1", () => {
			const base = new Map([["a", {x: 1}]])
			produce(base, draft => {
				expect(current(draft)).toBe(base)
				draft.delete("a")
				let [result, patches] = currentWithPatches(draft)
				expect(patches).toEqual([{op: "remove", path: ["a"]}])
				const obj = {}
				draft.set("b", obj)
				patches = currentWithPatches(draft)[1]
				expect(patches).toEqual([
					{op: "remove", path: ["a"]},
					{op: "add", path: ["b"], value: obj}
				])
				expect(result).toBeInstanceOf(Map)
			})
		})

		it("handles map - 2", () => {
			const base = new Map([["a", {x: 1}]])
			produce(base, draft => {
				draft.get("a").x++
				const [result, patches] = currentWithPatches(draft)
				expect(patches).toEqual([{op: "replace", path: ["a", "x"], value: 2}])
				expect(result).toEqual(new Map([["a", {x: 2}]]))
			})
		})

		it("handles set", () => {
			const base = new Set([1])
			produce(base, draft => {
				expect(current(draft)).toBe(base)
				draft.add(2)
				const [result, patches] = currentWithPatches(draft)
				expect(patches).toEqual([{op: "add", path: [1], value: 2}])
				expect(result).toEqual(new Set([1, 2]))
				expect(result).toBeInstanceOf(Set)
			})
		})

		it("handles simple class", () => {
			class Counter {
				[immerable] = true
				current = 0

				inc() {
					this.current++
				}
			}

			const counter1 = new Counter()
			produce(counter1, draft => {
				expect(current(draft)).toBe(counter1)
				draft.inc()
				const [result, patches] = currentWithPatches(draft)
				expect(patches).toEqual([{op: "replace", path: ["current"], value: 1}])
				expect(result.current).toBe(1)
				expect(result).toBeInstanceOf(Counter)
			})
		})

		it("", () => {})
	})
}
