const FormData = require('form-data');
const Item = require('./item');
const uuid = require('./uuid');

/**
 * List class.
 * @class
 *
 * @param {object} list list
 * @param {object} context context
 *
 * @property {string} identifier
 * @property {string} parentId
 * @property {string} name
 * @property {Item[]} items
 */
class List {
	/**
   * @hideconstructor
   */
	constructor(list, {client, protobuf, uid, recentItems}) {
		this.identifier = list.identifier;
		this.parentId = list.listId;
		this.name = list.name;

		this.items = list.items.map(i => new Item(i, {client, protobuf, uid}));
		this.client = client;
		this.protobuf = protobuf;
		this.uid = uid;
		this.recentItems = recentItems;
	}

	/**
   * Adds an item to this list.
   * Will also save item to local
   * copy of list.
   * @param {Item} item to add
   * @return {Promise<Item>} saved item
   */
	async addItem(item) {
		if (item.constructor !== Item) {
			throw new TypeError('Must be an instance of the Item class.');
		}

		item.listId = this.identifier;

		const op = new this.protobuf.PBListOperation();

		op.setMetadata({
			operationId: uuid(),
			handlerId: 'add-shopping-list-item',
			userId: this.uid,
		});

		op.setListId(this.identifier);
		op.setListItemId(item.identifier);
		op.setListItem(item._encode());

		const ops = new this.protobuf.PBListOperationList();

		ops.setOperations([op]);

		const form = new FormData();

		form.append('operations', ops.toBuffer());
		await this.client.post('data/shopping-lists/update', {
			body: form,
		});

		this.items.push(item);

		return item;
	}

	/**
   * Adds a recipe ingredient to this list.
   * Finds a matching item on the list or in
   * its recent items history by name.
   * @param {Ingredient} ingredient ingredient from a recipe
   * @param {object} options recipe context
   * @param {string} options.recipeId
   * @param {string} options.recipeName
   * @param {string} [options.eventId]
   * @param {string} [options.eventDate]
   * @return {Promise}
   */
	async addIngredient(ingredient, {recipeId, recipeName, eventId, eventDate}) {
		let existingItem = this.items.find(i => i.name === ingredient.name);

		if (!existingItem && this.recentItems) {
			const recent = this.recentItems[this.identifier];
			if (recent) {
				existingItem = recent.find(i => i.name === ingredient.name);
			}
		}

		const itemId = existingItem ? existingItem.identifier : uuid();

		const listItem = new this.protobuf.ListItem({
			identifier: itemId,
			listId: this.identifier,
			name: ingredient.name,
			userId: this.uid,
			categoryMatchId: existingItem ? existingItem.categoryMatchId : 'other',
			ingredients: [{
				ingredient: ingredient._encode(),
				recipeId,
				eventId,
				recipeName,
				eventDate,
			}],
		});

		const op = new this.protobuf.PBListOperation();

		op.setMetadata({
			operationId: uuid(),
			handlerId: 'add-item-ingredient-to-list-item',
			userId: this.uid,
		});

		op.setListId(this.identifier);
		op.setListItemId(itemId);
		op.setListItem(listItem);

		const ops = new this.protobuf.PBListOperationList();

		ops.setOperations([op]);

		const form = new FormData();

		form.append('operations', ops.toBuffer());
		await this.client.post('data/shopping-lists/update', {
			body: form,
		});
	}

	/**
   * Uncheck all items in a list
   * @return {Promise}
   */

	async uncheckAll() {
		const op = new this.protobuf.PBListOperation();

		op.setMetadata({
			operationId: uuid(),
			handlerId: 'uncheck-all',
			userId: this.uid,
		});

		op.setListId(this.identifier);
		const ops = new this.protobuf.PBListOperationList();
		ops.setOperations([op]);
		const form = new FormData();
		form.append('operations', ops.toBuffer());
		await this.client.post('data/shopping-lists/update', {
			body: form,
		});
	}

	/**
   * Remove an item from this list.
   * Will also remove item from local
   * copy of list.
   * Must set `isFavorite=true` if editing "favorites" list
   * @param {Item} item to remove
   * @param {boolean} [isFavorite=false]
   * @return {Promise}
   */
	async removeItem(item, isFavorite = false) {
		const op = new this.protobuf.PBListOperation();

		op.setMetadata({
			operationId: uuid(),
			handlerId: isFavorite ? 'remove-item' : 'remove-shopping-list-item',
			userId: this.uid,
		});

		op.setListId(this.identifier);
		op.setListItemId(item.identifier);
		op.setListItem(item._encode());

		const ops = new this.protobuf.PBListOperationList();

		ops.setOperations([op]);

		const form = new FormData();

		form.append('operations', ops.toBuffer());

		await this.client.post(isFavorite ? 'data/starter-lists/update' : 'data/shopping-lists/update', {
			body: form,
		});

		this.items = this.items.filter(i => i.identifier !== item.identifier);
	}

	/**
   * Get Item from List by identifier.
   * @param {string} identifier item ID
   * @return {Item} found Item
   */
	getItemById(identifier) {
		return this.items.find(i => i.identifier === identifier);
	}

	/**
   * Get Item from List by name.
   * @param {string} name item name
   * @return {Item} found Item
   */
	getItemByName(name) {
		return this.items.find(i => i.name === name);
	}
}

module.exports = List;
