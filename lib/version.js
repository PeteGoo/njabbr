(function(exports) {

  var util = require('util');

  exports.Version = {
    Major: 1,
    Minor: 1,
    Patch: 0,
    to_s: function() {
      return util.format('%d.%d.%d', this.Major, this.Minor, this.Patch);
    }
  };

})(module.exports);
