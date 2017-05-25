exports.add = function (record) {
  const obj = this.getPlainObject(record);
  const idField = this.primaryKey;
  const id = obj[idField];
  const name = this.name;
  const storage = this.storage;
  const store = this.store;

  const ids = this.records.map(row => row[idField]);
  const index = ids.indexOf(id);

  let result;
  if (index < 0){
    result = storage.create(store, name, obj, idField);
  }else{
    result = storage.update(store, name, obj, idField);
  }

  if (result){
    if (record.$set){
      record.$set(result);
    }else{
      record = new this.Record(Object.assign({}, record, result));
    }
  }
  return record;
};

exports.remove = function (record) {
  const obj = this.getPlainObject(record);
  const idField = this.primaryKey;
  const id = obj[idField];
  const name = this.name;
  const storage = this.storage;
  const store = this.store;

  const ids = this.records.map(row => row[idField]);
  const index = ids.indexOf(id);

  if (index > -1){
    return storage.delete(store, name, obj, idField);
  }
};

exports.create = function (record) {
  return this.$promise.resolve()
    .then(() => {
      if (this.api.create && this.http){
        let obj = this.getPlainObject(record);
        return this.http({
          url : this.api.create.url,
          method : this.api.create.method,
          data : obj
        }).then(response => {
          record.$set(response.data);
        });
      }
    })
    .then(() => {
      return this.add(record);
    });
};

exports.update = function (record) {
  const backup = Object.assign({}, record.$proxy);
  const changes = record.$changes;
  const obj = Object.assign({}, changes);
  const idField = this.primaryKey;
  const id = record[idField];
  const params = {};
  obj[idField] = id;
  params[idField] = id;

  // clear the record's changes as they will hopefully be re-set as committed values
  record.$changes = {};

  // update the local store first
  let returnable = this.add(obj);
  if (!returnable.then || !returnable.catch){
    returnable = this.$promise.resolve();
  }

  return returnable
    .then(() => {
      // send an update request to the api
      if (this.api.update && this.http){
        let url = this.$urlBuilder.buildUrl(this.api.update.url, params);

        return this.http({
          url : this.api.update.url,
          method : this.api.update.method,
          data : obj
        })
        .then(response => {
          // the response may contain amended values, so update the record with them
          if (response.data && response.data[idField]){
            this.add(response.data);
            return record;
          }
        });
      }else{
        return record;
      }
    })
    .catch(err => {
      // restore the original stored value
      this.add(backup);
      // restore the record's changes property
      record.$changes = changes;
      throw err;
    });
};

exports.delete = function (record) {
  const backup = Object.assign({}, record.$proxy);
  const idField = this.primaryKey;
  const id = record[idField];
  const params = {};
  params[idField] = id;

  let returnable = this.remove(record);
  if (!returnable.then || !returnable.catch){
    returnable = this.$promise.resolve();
  }

  return returnable
    .then(() => {
      if (this.api.delete && this.http){
        let url = this.$urlBuilder.buildUrl(this.api.delete.url, params);

        return this.http({
          url : this.api.delete.url,
          method : this.api.delete.method
        });
      }
    })
    .catch(err => {
      // restore the original stored value
      this.add(backup);
      throw err;
    });
};
