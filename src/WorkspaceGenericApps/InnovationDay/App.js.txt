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
			html: ['<center><div id="release_info"></div>',
				'<p>Please add your ideas or vote. You can vote only once. We appreciate your ideas and feeback. Thank you!</p>',
				'</center>'
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
			id: 'ideaGrid',
			cls:'idea-grid'
			}
		],
		_createGridStore: function(){
			var me = this;
			me.voted = false;
			me.ideaOwnerUserObjectId = Rally.data.PreferenceManager._getCurrentUserRef().replace("/user/","");
			var themedata = me.currentRelease.data.Theme.length> 0 ? JSON.parse(atob(me.currentRelease.data.Theme)):{};
			//find if they have voted or not 
			var votedUser = _.pluck(themedata,'voteCount');
			
			_.each(votedUser, function(user){
					var a = user.indexOf(me.ideaOwnerUserObjectId);
					if(a > -1) {me.voted = true; return;}
				});
			me._renderGrid(themedata);
		},
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
						var id = Ext.id();
						Ext.defer(function () {
							Ext.widget('button', {
									renderTo: id,
									text: '+ Vote',
									width: 60,
									disabled: me.voted
							});
						}, 50);
						return Ext.String.format('<div id="{0}"></div>', id);
					}
				},{
					header: "Owner", 
					dataIndex: "owner",
					hidden:true
				}];	
			return columnConfiguration;
		},
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
		_renderGrid: function(themedata){
			var me = this;
			me.firstTime = false;
			if (themedata.length > 0)
			{

			}else{
				//hack as adding record the first time didnt work with mystore.loadData()
				themedata = [{
					Ideas: "",
					Why: "",
					voteCount:0,
					owner: me._guid(),
					Vote: ""
				}];
				me.firstTime = true;
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
							if (cellIndex === 4 && me.voted === false){
								record.data.voteCount.push(me.ideaOwnerUserObjectId);
								me._saveVote(record);
								Ext.getCmp('rallyIdeaGrid').view.refresh();
								me.voted = true;
							}
						}
					}, 
					store: gridStore
				}],
				renderTo:'ideaGrid'
			});					
		},
		_loadCurrentReleasesbyObjectId: function(){
			var me=this,
				store = Ext.create('Rally.data.wsapi.Store',{
					model: 'Release',
					limit: Infinity,
					autoLoad:false,
					fetch: ['Name', 'ObjectID', 'Theme'],
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
						voteCount:[me.ideaOwnerUserObjectId],
						owner: me._guid(),
						Vote: ""
					}];
					 
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
		_setReleaseThemeRecord: function(str){
		var me=this,
			deferred = Q.defer();	
			/* newidea = me.currentRelease.data.Theme.length > 0 ? newidea.concat(JSON.parse(atob(me.currentRelease.data.Theme))) : newidea;
			str = btoa(JSON.stringify(newidea, null, '\t')); */
		if(str.length >= 32768) 
			deferred.reject('Theme field for ' + me.currentRelease.data.Theme + ' ran out of space! Cannot save');
		else {
			me.currentRelease.set('Theme',str);
			me.currentRelease.save({ 
				callback:function(record, operation, success){
					if(!success) deferred.reject('Failed to add new idea to the Release: ' + me.currentRelease.data.Name);
					else deferred.resolve(me.currentRelease);
				}
			});
		}
		return deferred.promise;			
	},
		_saveVote:function(votedrecord){
		var me = this;
		var resultStrAfterVoted;
		return me._loadCurrentReleasesbyObjectId()
		.then(function(record){
			var recordChangedId = votedrecord.data.owner;
			var resultObj = JSON.parse(atob(record[0].data.Theme));
			_.each(resultObj,function(r,key){
				if(r.owner === recordChangedId)
				{
					r.voteCount.push(me.ideaOwnerUserObjectId);
					var resultStrAfterVoted = btoa(JSON.stringify(resultObj, null, '\t'));
					me._setReleaseThemeRecord(resultStrAfterVoted);
				}
			});
			//edit record by saving voteCount
			//save it
		});
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
						$("#release_info").html("InnovationDay Ideas for Release: " + me.currentRelease.data.Name);
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

