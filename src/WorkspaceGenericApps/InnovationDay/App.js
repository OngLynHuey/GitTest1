(function(){
	var Ext = window.Ext4 || window.Ext;
	Ext.define('Intel.InnovationDay', {
		extend: 'Intel.lib.IntelRallyApp',
		componentCls: 'app',
		mixins: [
			'Intel.lib.mixin.PrettyAlert',
			'Intel.lib.mixin.UserAppsPreference',
			'Intel.lib.mixin.ParallelLoader',
			'Intel.lib.mixin.CustomAppObjectIDRegister'
		],
		userAppsPref: 'intel-innovationday-apps-preference',
		releaseFields:[],
		items: [{
			xtype: 'container',
			id: 'idea_wrapper',
			cls: 'ideawrapper',
			html: ['<div id="release_info">INNOVATION DAY <i class="fa fa-lightbulb-o"></i></div>',
				'<div class = "indicator"><i class="fa fa-undo"></i> = Undo Voting<br/> <i class="fa fa-thumbs-o-up"></i> = Vote</div>'
			].join('\n')
			},{
			xtype: 'container',
			id: 'idea_innerwrapper',
			cls: 'idea-innerwrapper',
			layout: {
				type: 'hbox'
			},
			items:[{
				xtype: 'textfield',
				id: 'ideaTxt',
				fieldLabel: 'IDEA (max 100 char)',
				labelWidth: 120,
				width:'40%',
				maxLength:100
				},{
				xtype: 'textfield',
				fieldLabel: 'WHY (max 100 char)',
				labelWidth: 120,
				width:'40%',
				padding : '0 10 0 10',
				id: 'whyTxt',
				maxLength:100,
				allowBlank: true					
			},{
				xtype: 'container',
				id: 'ideaBtnContainer'
			}]
			},{
				xtype: 'container',
				id: 'refreshgrid'
			},{
				xtype: 'container',
				id: 'ideaGrid',
				cls:'idea-grid'
			}
		],
		/**___________________________________ DATA STORE METHOD ___________________________________*/	
		_loadCurrentReleasesbyObjectId: function(){
			var me=this,
				store = Ext.create('Rally.data.wsapi.Store',{
					model: 'Release',
					limit: Infinity,
					autoLoad:false,
					fetch: ['Name', 'ObjectID', 'ReleaseDate', 'ReleaseStartDate', 'Theme'],
					context:{
						workspace: me.getContext().getWorkspace()._ref,
						project: null
					},
					filters:[{
						property:'ObjectID',
						value: me.currentRelease.data.ObjectID
					}]
				});
			return me.reloadStore(store).then(function(store){ return store.getRange(); });				
		},
		_loadReleasesBetweenDates: function(projectRecord, startDate, endDate){
			var me=this,
				store = Ext.create('Rally.data.wsapi.Store',{
					model: 'Release',
					limit: Infinity,
					autoLoad:false,
					fetch: ['Name', 'ObjectID', 'ReleaseDate', 'ReleaseStartDate', 'Theme'],
					context:{
						workspace: me.getContext().getWorkspace()._ref,
						project: null
					},
					filters:[{
						property:'Project.ObjectID',
						value: projectRecord.data.ObjectID
					},{
						property:'ReleaseDate',
						operator:'>',
						value: new Date(startDate).toISOString()
					},{
						property:'ReleaseStartDate',
						operator:'<',
						value: new Date(endDate).toISOString()
					}]
				});
			return me.reloadStore(store).then(function(store){ return store.getRange(); });
		},
		/**___________________________________ Grid Config ___________________________________*/
		_getColumnConfig: function(){
			var me = this;
			var columnConfiguration = [
				{	header: "Ideas", 
					dataIndex: "Ideas",
					flex:2
				},{
					header: "Why", 
					dataIndex: "Why",
					flex:2
				},{
					header: "Vote Count", 
					dataIndex: "voteCount",
					renderer:function(val, meta, record){
						return val.length;
					}
				},{
					header: "Vote", 
					dataIndex: "Vote",		
					renderer: function (v, m, r) {
						if(me._isIdeaOwner(r.data.owner)){
							var id = Ext.id();
							Ext.defer(function () {
								Ext.widget('button', {
										renderTo: id,
										text: 'Delete',
										width: 60
								});
							}, 50); 
						return Ext.String.format('<div id="{0}"></div>', id);							
						}else {
							var voteIcon =  me._alreadyVoted(r.data.voteCount) ? '<i class="fa fa-undo"></i>' : '<i class="fa fa-thumbs-o-up"></i>';							
							return voteIcon;
						}
					}
				},{
					header: "id", 
					dataIndex: "id",
					hidden:true
				},{
					header: "Owner", 
					dataIndex: "owner",
					hidden: true
				}];	
			return columnConfiguration;
		},
		_createGridStore: function(){
			var me = this;
			me.voted = false;
			var themedata = me.currentRelease.data.Theme.length> 0 ? JSON.parse(atob(me.currentRelease.data.Theme)):{};
			me._renderGrid(themedata);
		},
		_isIdeaOwner :function(owner){
			var me = this;
			return (owner === me.currentUserObjectId ? true :false);
		},
		_alreadyVoted: function(voteRecord){
			var me = this;
			//if you are the owner you cant vote
			//else you can vote
			return voteRecord.indexOf(me.currentUserObjectId) > -1 ? true : false;
		},
		_getVotingAction: function(owner,voteRecord){
			var me = this;
			var voteAction = "";
			if(me._isIdeaOwner(owner)){
				return "Delete";
			}else if(me._alreadyVoted(voteRecord) && me._isIdeaOwner(owner) === false){
				return "Undo";
			}else if(me._alreadyVoted(voteRecord) === false && me._isIdeaOwner(owner) === false){
				return "Vote";
			}else{
				return "";
			}
		},
		/**___________________________________ Grid Render ___________________________________*/
		_renderGridRefresh: function(){
			var me = this;
			if(! Ext.getCmp('refreshButton')){
				Ext.create('Ext.Button', {
					id:'refreshButton',
					text: 'Click here to refresh grid for new changes',
					renderTo: 'refreshgrid',
					handler: function() {
							me._refreshGrid();
					}
				});
			}
		},
		_renderGrid: function(themedata){
			var me = this;
			me.firstTime = false;
			if (themedata.length > 0)
			{

			}else{
				//hack as adding record the first time didnt work with mystore.loadData()
				//TODO add the first record with LoadData()
				themedata = [{
					Ideas: "",
					Why: "",
					voteCount:0,
					id: me._guid(),
					Vote: "",
					owner: ""
				}];
				me.firstTime = true;
			}
			if(me.firstTime === false){
				me._renderGridRefresh();				
			}
			var gridStore = Ext.create('Rally.data.custom.Store',{
					data: themedata
			});
			//API Docs: https://help.rallydev.com/apps/2.0/doc/
			Ext.create('Ext.Container', {
				items:[{
					xtype: 'rallygrid',
					id:'rallyIdeaGrid',
					enableEditing: false,
					autoScroll: true,
					height: 800,
					showPagingToolbar: false,
					columnCfgs: me._getColumnConfig(),
					listeners: {
						cellclick: function(table, td, cellIndex, record, tr, rowIndex){
							var action = me._getVotingAction(record.data.owner,record.data.voteCount);
							function deletedRecord(btn){
								if(btn==="yes"){
									var gridStore = Ext.getCmp('rallyIdeaGrid').getStore();
									gridStore.remove(record); 
									me._deleteRecord(record);												
								}
							}									
							//me.voted = me._alreadyVoted(record.data.voteCount);
							if (cellIndex === 4){
								if (action === "Vote"){
									record.data.voteCount.push(me.currentUserObjectId);
									me._saveVote(record);
									Ext.getCmp('rallyIdeaGrid').view.refresh();
								}else	if(action === "Delete"){
									Ext.MessageBox.confirm('Confirm', 'Are you sure you want to delete the idea?',deletedRecord);
								}else if (action === "Undo"){
									me._undoVoting(record);
									record.data.voteCount.splice(record.data.voteCount.indexOf(me.currentUserObjectId),1);
									Ext.getCmp('rallyIdeaGrid').view.refresh();
								}								
							}
						}
					}, 
					store: gridStore
				}],
				renderTo:'ideaGrid'
			});					
		},
		_addIdeaToGrid: function(){
			var me = this;
			var ideaText, whyText;
			var ideaButton = {
				xtype: 'button',
				id: 'addIdeaBtn',
				text: 'Add Idea',
				scope: me,
				handler: function(){
					//add the idea nd why to the grid
					//update the grid
					var alertMessage = me._validation();
					if(alertMessage.length > 0 ){
						me.alert(alertMessage);
					}else{
					ideaText = Ext.getCmp('ideaTxt').value;
					whyText = typeof Ext.getCmp('whyTxt').value === "undefined" ? "" : Ext.getCmp('whyTxt').value;
					var myStore = Ext.getCmp('rallyIdeaGrid').getStore();
					var newidea = [{
						Ideas: ideaText,
						Why: whyText,
						voteCount:[me.currentUserObjectId],
						id: me._guid(),
						owner: me.currentUserObjectId,
						Vote: ""
					}];
					me.voted = true;//you get to either vote or add ideas
					if(me.firstTime){
						me.firstTime = false;
						myStore.loadData(newidea,false);
						Ext.getCmp('rallyIdeaGrid').show();
					}else{
						myStore.loadData(newidea,true);
						Ext.getCmp('rallyIdeaGrid').show();
					}
					newidea = me.currentRelease.data.Theme.length > 0 ? newidea.concat(JSON.parse(atob(me.currentRelease.data.Theme))) : newidea;
					str = btoa(JSON.stringify(newidea, null, '\t'));
					me._setReleaseThemeRecord(str);
					Ext.getCmp('ideaTxt').setValue("");
					Ext.getCmp('whyTxt').setValue("");
					}
				}
			};
			Ext.getCmp('ideaBtnContainer').add(ideaButton);
			if (me.firstTime) 
				Ext.getCmp('rallyIdeaGrid').hide();
			//upgrade the grid with the value			
		},	
		_refreshGrid: function(){
			var me = this;
			return me._loadCurrentReleasesbyObjectId()
				.then(function(record){
					//re attach value
					me.currentRelease.data.Theme = record[0].data.Theme;
					var refreshedData = me.currentRelease.data.Theme.length > 0 ? JSON.parse(atob(me.currentRelease.data.Theme)):{};
					me.setLoading("ReLoading Grid");
					Ext.getCmp('rallyIdeaGrid').destroy();
					me._renderGrid(refreshedData);	
					me.setLoading(false);
				})
				.fail(function(reason){
						me.alert('ERROR', reason); 
						me.setLoading(false);
				})
				.done();			
		},
		/**___________________________________ Saving Records ___________________________________*/
		_setReleaseThemeRecord: function(str){
			var me=this,
				deferred = Q.defer();	
			if(str.length >= 32768) 
				deferred.reject('Theme field for ' + me.currentRelease.data.Name + ' ran out of space! Cannot save');
			else {
				me.currentRelease.set('Theme',str);
				me.currentRelease.save({ 
					callback:function(record, operation, success){
						if(!success) deferred.reject('Failed to add new idea to the Release: ' + me.currentRelease.data.Name);
						else deferred.resolve(success);
					}
				});
			}
			return deferred.promise;			
		},
		_saveVote:function(votedrecord){
			var me = this;
			var foundSavedRecord = false;
			var resultStrAfterVoted;
			return me._loadCurrentReleasesbyObjectId()
			.then(function(record){
				var recordChangedId = votedrecord.data.id;
				var resultObj = JSON.parse(atob(record[0].data.Theme));
				_.each(resultObj,function(r,key){
					if(r.id === recordChangedId)
					{
						r.voteCount.push(me.currentUserObjectId);
						var resultStrAfterVoted = btoa(JSON.stringify(resultObj, null, '\t'));
						me._setReleaseThemeRecord(resultStrAfterVoted);
						foundSavedRecord = true;
					}
					if (foundSavedRecord) return false;
				});
				//edit record by saving voteCount
				//save it
			})
			.fail(function(reason){
					me.alert('ERROR', reason); 
			})
			.done();
		},	
		_deleteRecord: function(deletedRecord){
			var me = this;
			var foundDeletedRecord = false;
			var resultStrAfterVoteDeleted;
			return me._loadCurrentReleasesbyObjectId()
				.then(function(record){
					var recordDeltedId = deletedRecord.data.id;
					var resultObj = JSON.parse(atob(record[0].data.Theme));	
					_.each(resultObj,function(r,key){
						if(r.id === recordDeltedId && r.owner === deletedRecord.data.owner)
						{
							resultObj.splice(key,1);
							var resultStrAfterVoteDeleted = btoa(JSON.stringify(resultObj, null, '\t'));
							me._setReleaseThemeRecord(resultStrAfterVoteDeleted);
							foundDeletedRecord = true;
						}
						if (foundDeletedRecord) return false;
					});				
				})
				.fail(function(reason){
						me.alert('ERROR', reason); 
				})
				.done();
			
		},
		_undoVoting: function(undoneRecord){
			var me = this;
			var foundEditedRecord = false,
				resultStrAfterUndoVote;
				return me._loadCurrentReleasesbyObjectId()
				.then(function(record){
					var recordChangedId = undoneRecord.data.id;
					var resultObj = JSON.parse(atob(record[0].data.Theme));	
					_.each(resultObj,function(r,key){
						if(r.id === recordChangedId && me._alreadyVoted(undoneRecord.data.voteCount))
						{
							var targetVoteRecordIndex = resultObj[key].voteCount.indexOf(me.currentUserObjectId);
							resultObj[key].voteCount.splice(targetVoteRecordIndex,1);
							var resultStrAfterUndoVote = btoa(JSON.stringify(resultObj, null, '\t'));
							me._setReleaseThemeRecord(resultStrAfterUndoVote);
							foundEditedRecord = true;
						}
						if (foundEditedRecord) return false;
					});				
				})
				.fail(function(reason){
					me.alert('ERROR', reason); 
				})
				.done();				
		},
		/**___________________________________ Validation___________________________________*/
		_validation: function(){
			var validation = "";
			if(typeof Ext.getCmp('ideaTxt').value !="undefined"){
				if(Ext.getCmp('ideaTxt').value.length > 100) {validation += "<p>The maximum length for IDEA field is 100.</p>"; }	
				if(Ext.getCmp('ideaTxt').value.length === 0){	validation += "<p>The IDEA field cannot be empty.</p>";	}				
			}else{
				validation += "<p>The IDEA field cannot be empty.</p>";									
			}
			
			if(typeof Ext.getCmp('whyTxt').value !="undefined" && Ext.getCmp('whyTxt').value.length > 100) {
				validation += "<p>The maximum length for WHY field is 100.</p>";
			}
			return validation;
		},
		_guid: function() {
			function s4() {
				return Math.floor((1 + Math.random() + Math.random()) * 0x10000);
			}
			return s4();
		},
		launch: function() {
				var me = this;
				//override the intel app release field config 
				
				me.setLoading('Loading Configuration');
				me.currentUserObjectId = Rally.data.PreferenceManager._getCurrentUserRef().replace("/user/","");
				me.configureIntelRallyApp()
				.then(function(){
					//me.releaseFields =  ['Name', 'ObjectID', 'ReleaseDate', 'ReleaseStartDate','Theme','c_Theme']
					var scopeProject = me.getContext().getProject();
					return me.loadProject(scopeProject.ObjectID)
					.then(function(scopeProjectRecord){
						me.ProjectRecord = scopeProjectRecord;
						me.loadAppsPreference(); /******** load stream 2 *****/
					})
					.then(function(appsPref){
						me.AppsPref = appsPref;
						var sixMonths = 1000*60*60*24*183;
						var endDate = new Date();
						return me._loadReleasesBetweenDates(me.ProjectRecord, (new Date()*1 - sixMonths), endDate);
					})					
					.then(function(releaseRecords){
						me.ReleaseRecords = releaseRecords;
						me.currentRelease = me.getScopedRelease(releaseRecords, me.ProjectRecord.data.ObjectID, null);
						//$("#release_info").html("InnovationDay Ideas for Release: " + me.currentRelease.data.Name);
					});					
				})
				.then(function(){
					//load current relese
					//Write app code here
					me._createGridStore();
				})
				.then(function(){
					me._addIdeaToGrid();
					me.setLoading(false);
				})
				.fail(function(reason){
					me.setLoading(false);
					me.alert('ERROR', reason); 
				})
				.done();
			}
	});
}());

