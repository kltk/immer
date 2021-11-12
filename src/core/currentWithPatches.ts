import {
	Archtype,
	die,
	DRAFT_STATE,
	each,
	get,
	getArchtype,
	getPlugin,
	ImmerState,
	isDraft,
	isDraftable,
	isFrozen,
	Patch,
	PatchPath,
	ProxyType,
	set,
	shallowCopy
} from "../internal"

export function currentWithPatches(draft: any) {
	if (!isDraft(draft)) die(22, draft)

	const {scope_: scope} = draft[DRAFT_STATE]

	// es5.ts:32
	scope.patches_ = []
	// assign assigned_ from base_/draft_
	if (!scope.immer_.useProxies_)
		getPlugin("ES5").willFinalizeES5_(scope, undefined, false)

	const patches: Patch[] = []
	const inversePatches: Patch[] = []
	const result = currentWithPatchesImpl(draft, [], patches, inversePatches)
	// restore es5.ts:32
	scope.patches_ = undefined
	return [result, patches, inversePatches]
}

function currentWithPatchesImpl(
	value: any,
	path: PatchPath,
	patches: Patch[],
	inversePatches: Patch[]
) {
	if (!isDraftable(value)) return value
	if (isFrozen(value)) return value

	const state: ImmerState | undefined = value[DRAFT_STATE]
	const archType = getArchtype(value)
	let copy: any
	if (state) {
		// finalize.ts:26
		if (
			!state.modified_ &&
			(state.type_ < 4 || !getPlugin("ES5").hasChanges_(state as any))
		)
			return state.base_

		// finalize.ts:84
		// For ES5, create a good copy from the draft first, with added keys and without deleted keys.
		if (
			state.type_ === ProxyType.ES5Object ||
			state.type_ === ProxyType.ES5Array
		)
			state.copy_ = shallowCopy(state.draft_)

		state.finalized_ = true
		copy = copyHelper(value, archType)
		state.finalized_ = false
		getPlugin("Patches").generatePatches_(state, path, patches, inversePatches)
	} else {
		copy = copyHelper(value, archType)
	}

	each(copy, (key, childValue) => {
		if (state && get(state.base_, key) === childValue) return
		const nextValue = currentWithPatchesImpl(
			childValue,
			path.concat(key),
			patches,
			inversePatches
		)
		set(copy, key, nextValue)
	})
	// In the future, we might consider freezing here, based on the current settings
	return archType === Archtype.Set ? new Set(copy) : copy
}

function copyHelper(value: any, archType: number): any {
	// creates a shallow copy, even if it is a map or set
	switch (archType) {
		case Archtype.Map:
			return new Map(value)
		case Archtype.Set:
			// Set will be cloned as array temporarily, so that we can replace individual items
			return Array.from(value)
	}
	return shallowCopy(value)
}
