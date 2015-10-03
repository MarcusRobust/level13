// Loader for the changelog.json
define(['ash'], function (Ash) {

    var ChangeLogHelper = Ash.Class.extend({
		
		loadingSuccesfull: undefined,
		versions: null,
        
		constructor: function () {
			var helper = this;
            $.getJSON('changelog.json', function (json) {
				helper.loadingSuccessfull = true;
				helper.versions = json.versions;
			})
			.fail(function (jqxhr, textStatus, error) {
				helper.loadingSuccessfull = false;
				var err = textStatus + ", " + error;
				console.log("Request Failed: " + err);
			});
		},
		
		getCurrentVersionNumber: function () {
			var currentVersion = this.getCurrentVersion();
			if (currentVersion) {
				return this.getVersionNumber(currentVersion);
			}
			return "unknown";
		},
		
		getChangeLogHTML: function () {
			var html = "";
			var v;
			for (var i in this.versions) {
				v = this.versions[i];
				if (v.changes.length === 0) continue;
				html += "<div class='changelog-version'>";
				html += this.getVersionNumber(v);
				if (!v.final) html += " (work in progress)";
				html += "<ul>";
				for (var j in v.changes) {
					var change = v.changes[j];
					html += "<li>";
					html += "<span class='changelog-type changelog-type-" + change.type + "'>" + change.type + "</span>";
					html += "<span class='changelog-summary'>" + change.summary + "</span>";
					html += "</li>";
				}
				html += "</ul>";
				html += "</div>";
			}
			return html;
		},
		
		getVersionNumber: function (version) {
			return version.version + " (" + version.phase + ")";
		},
		
		getCurrentVersion: function () {
			if (!this.versions) return null;
			
			var version = null;
			var i = 0;
			while (!version && i < this.versions.length) {
				if (this.versions[i].changes.length > 0) version = this.versions[i];
				i++;
			}
			return version;
		}
	
    });
    
    return ChangeLogHelper;
});