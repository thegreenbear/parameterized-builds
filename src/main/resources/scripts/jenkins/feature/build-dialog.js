define('trigger/build-dialog', [
    'aui',
    'jquery',
    'exports',
    'bitbucket/internal/model/page-state',
    'bitbucket/internal/util/ajax',
    'aui/flag'
], function(
    _aui,
    $,
    exports,
    pageState,
    ajax,
    flag
) {
	var jobs;
	
	function bindToDropdownLink(linkSelector, dropDownSelector, getBranchNameFunction) {
        $(document).on('aui-dropdown2-show', dropDownSelector, function () {
        	var $dropdownMenu = $(this);
        	var $buildTriggerButton = $(linkSelector);
            var branchInfo = getBranchNameFunction($dropdownMenu);
            var branch = branchInfo[0];
            var commit = branchInfo[1];

            var triggerBuildSetup = function() {
            	var resourceUrl = getResourceUrl("getJobs") + "?branch=" + encodeURIComponent(branch) + "&commit=" + commit;
            	
            	jobs = getJobs(resourceUrl);
            	if (jobs.length == 1){
                	if (jobs[0].buildParameters.length == 0){
                		var buildUrl = getResourceUrl("triggerBuild/0");
                		triggerBuild(buildUrl);
                    	return false;
                	}
            	}
        		var buildUrl = getResourceUrl("triggerBuild");
            	showManualBuildDialog(buildUrl);
            	return false;
            };
            
            $buildTriggerButton.on('click', triggerBuildSetup);
            $dropdownMenu.on('aui-dropdown2-hide', function() {
            	$buildTriggerButton.off('click', triggerBuildSetup);
            });
            return false;
        });
    }
    
	function getResourceUrl(resourceType){
		return _aui.contextPath() + '/rest/parameterized-builds/latest/projects/' + pageState.getProject().getKey() + '/repos/'
        + pageState.getRepository().getSlug() + '/' + resourceType;
	}
    
	function getJobs(resourceUrl){
		var results;
		$.ajax({
		  type: "GET",
		  url: resourceUrl,
		  dataType: 'json',
		  async: false,
		  success: function (data){
			  results = data;
		  }
		});
		return results;
	}
	
    function showManualBuildDialog(buildUrl) {
        var dialog = _aui.dialog2(aui.dialog.dialog2({
            titleText: AJS.I18n.getText('Build with Parameters'),
            content: com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.buildDialog({
                jobs: jobs
            }),
            footerActionContent: com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.buildButton(),
            removeOnHide: true
        })).show();
        
        var jobSelector = document.getElementById("job");
        var selectedValue = jobSelector.options[jobSelector.selectedIndex].value;
        setupJobForm(jobs[selectedValue]);
        
        dialog.$el.find('form').on('submit', function(e) { e.preventDefault(); });
        dialog.$el.find('#start-build').on('click', function() {
            _.defer(function() {
            	var $jobParameters = dialog.$el.find('.jenkins-form');
            	var jobSelect = document.getElementById("job");
                var id = jobSelector.options[jobSelector.selectedIndex].value;
            	buildUrl += "/" + jobs[id].id + "?";
            	$jobParameters.each(function(index, jobParam) {
            		var $curJobParam = $(jobParam);
            		var key = $curJobParam.find('label').text();
            		var value = dialog.$el.find('#build-param-value-' + index).val();
            		var type = $(dialog.$el.find('#build-param-value-' + index)[0]).attr('class');
            		if (type.indexOf("checkbox") > -1) {
            			value = dialog.$el.find('#build-param-value-' + index)[0].checked;
            		} else if (type.indexOf("hidden") > -1) {
            			value = value.replace('refs/heads/','');
					}
            		buildUrl += key + "=" + encodeURIComponent(value) + "&";
            	});
            	triggerBuild(buildUrl.slice(0,-1));
                dialog.hide();
            });
        }).focus().select();
    }
	
	$(document).on('change', '#job', function(e) {
    	e.preventDefault();
    	setupJobForm(jobs[this.value]);
    });
	
	function setupJobForm(job) {
		var $container = $('.job-params');
		
		var html = '<div class="job-params">';
		var parameters = job.buildParameters;
		if (parameters) {
			for (i = 0; i < parameters.length; i++) {
				var keyValue = parameters[i];
				for (var key in keyValue){
					var value = keyValue[key];
					if (typeof value === "boolean") {
						html += com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.addBooleanParameter({
				            count: i,
				            key: key,
				            value: value
				        });
					} else if (typeof value === 'string') {
					    if (value.startsWith('refs/heads/')) {
					        html += com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.addBranchParameter({
                        		count: i,
                        		key: key,
                        		value: value
                        	});
					    } else {
						    html += com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.addStringParameter({
				                count: i,
				                key: key,
				                value: value
				            });
				        }
					} else {
						html += com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.addArrayParameter({
				            count: i,
				            key: key,
				            value: value
				        });
					}
				}
			}
		}
		$container.replaceWith(html + "</div>");
	}
	
	function triggerBuild(buildUrl){
		var successFlag = flag({
            type: 'success',
            body: 'Build started',
            close: 'auto'
        });
		ajax.rest({
		  type: "POST",
		  url: buildUrl,
		  dataType: 'json',
		  async: true
		}).success(function (data) {
    		if (data.error){
    			successFlag.close();
    			flag({
                    type: 'warning',
                    body: data.messageText,
                    close: 'auto'
                });
    		} else if (data.prompt) {
    			var promptCookie = getCookie("jenkinsPrompt");
    			var settingsPath = _aui.contextPath() + "/plugins/servlet/account/jenkins";
    			if (promptCookie !== "ignore") {
	    			flag({
	                    type: 'info',
	                    body: '<p>Optional: <a href="' + settingsPath + 
	                    '" target="_blank">You can link your Jenkins account to your Bitbucket account.</a></p>' + 
	                    '<br/><label><input id="prompt-cookie" type="checkbox" /><span>Don\'t show again</span></label>'
	                });
    			}
    		}
		});
	};
	
	$(document).on('change', '#prompt-cookie', function(e) {
		var d = new Date();
	    d.setTime(d.getTime() + (365*24*60*60*1000));
	    var expires = "expires="+ d.toUTCString();
		document.cookie = "jenkinsPrompt=ignore;" + expires + ";path=/";
    });
	
	function getCookie(cname) {
	    var name = cname + "=";
	    var ca = document.cookie.split(';');
	    for(var i = 0; i <ca.length; i++) {
	        var c = ca[i];
	        while (c.charAt(0)==' ') {
	            c = c.substring(1);
	        }
	        if (c.indexOf(name) == 0) {
	            return c.substring(name.length,c.length);
	        }
	    }
	    return "";
	}
	
    exports.bindToDropdownLink = bindToDropdownLink;
});