var newscope = true;
Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
    componentCls: 'app',
    width: 600,
    layout:{
        type: 'vbox'
    },
    scopeType: 'release',
    launch: function() {
        console.log('Starting load of all components for Sanity Dashboard');
        this.add( //{{{
        /*{
            xtype: 'container',
            itemId: 'releaseInfo',
            tpl: [
               '<div class="releaseInfo"><p><b>About this release: </b><br />',
                '<p class="release-notes">{notes}</p>',
                'Additional information is available <a href="{detailUrl}" target="_top">here.</a></p></div>'
               ]
        },*/
        {  
            xtype: 'container',
            itemId: 'ribbon',
            width: 1400,
            height: 350,
            hidden: true,
            border: 1,
            layout: {
                type: 'hbox',
                align: 'stretch',
                pack: 'center',
                margin: '20px'
            },
            style: {
                borderColor: '#AAA',
                borderStyle: 'solid'
            }
        },
        {
            xtype: 'container',
            itemId: 'gridsContainer',
            padding: 5,
            layout: {
                type: 'hbox',
                align: 'top'
            },
            items: [
            {
                xtype: 'container',
                itemId: 'gridsLeft',
                width: 695,
                border: 1,
                style: {
                    borderColor: '#AAA',
                    borderStyle: 'solid'
                }
                /*items: [
                { 
                    xtype: 'component',
                    html: "<b>Story Health</b>"
                }]*/
            },
        {
            xtype: 'container',
            itemId: 'gridsRight',
            width: 695,
            border: 1,
            style: {
                borderColor: '#AAA',
                borderStyle: 'solid'
            }
            /*items: [{ 
                xtype: 'component',
                html: "<b>Feature Health</b>"
            }]*/
       }
        ]
      }); //}}}
    this.callParent(arguments);
    },

    onScopeChange: function(scope) { ///{{{
        console.log('Scope changed to', scope, this);
        this.down('#ribbon').removeAll();
        this.globalGridCount=[];   // count entry for each grid
        this.globalGridMap={'C1':'', 'C2':'', 'C3':'','C4':'','C5':'','C6':'', 'C7': ''};
        this.globalStoryCount=[];
        this.globalTeamCount={};
        //this.down('#ribbon').hide();
        this._gridsLoaded = false;
        this.down('#gridsLeft').removeAll();
        this.down('#gridsRight').removeAll();
        this._loadReleaseDetails(scope);
        this._buildGrids(scope);
        this.readyFired = false;
        this._chartsReady=false;
        window.newscope=true;
    },///}}}

    _refreshGrids: function() { ///{{{
        console.log('Refreshing Grids');
        var filter = [this.getContext().getTimeboxScope().getQueryFilter()];
        var gridContainerLeft = this.down('#gridsLeft');
        var gridContainerRight = this.down('#gridsRight');
        gridContainerLeft.down('#C1').filter(filter, true, true);
        gridContainerLeft.down('#C3').filter(filter, true, true);
        gridContainerLeft.down('#C5').filter(filter, true, true);
        gridContainerLeft.down('#C7').filter(filter, true, true);
        gridContainerLeft.down('#C2').filter(filter, true, true);
        gridContainerRight.down('#C4').filter(filter, true, true);
        gridContainerRight.down('#C6').filter(filter, true, true);
    },///}}}

    _loadReleaseDetails: function(scope) {//{{{
        var release = scope.getRecord();
        var project = this.getContext().getProject();
        console.log('Release', release);
        //console.log(release.raw.Project);
        console.log('Project ', project);
        console.log(project.Name);
        //if(release.getProject() != project.ObjectID)
        //    console.log('Not in release');
        //console.log('Data Context', this.getContext().getDataContext());
        //console.log('Context', this.getContext());
        //console.log('Timebox Scope', this.getContext().getTimeboxScope());
        //console.log('Project Down Context', this.getContext().getProjectScopeDown());
        //this.setContext(project);
        //console.log('New scope', this.getContext());
        var releaseStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Release',
            autoLoad: true,
            fetch: ['Name', 'Project'],
            context: this.getContext().getProject(),
            filters: [ { 
                            property: 'Project.ObjectID',
                            operator: '=',
                            value: project.ObjectID 
                      }],
            listeners: {
                        load: function(records)
                                {
                                  console.log('Found releases', records); 
                                }
                       }
        });
        //console.log('First in store', releaseStore);
        if (release) {
            var releaseModel = release.self;
            releaseModel.load(Rally.util.Ref.getOidFromRef(release), {
                fetch: ['Notes'],
                success: function(record) {
                    //console.log('Found Train', this.getContext().getProject());
                    /*this.down('#releaseInfo').update({
                        detailUrl: Rally.nav.Manager.getDetailUrl(release),
                        notes: record.get('Notes')
                    });*/ 
                },
                scope: this
            });
        }
    },//}}}

    // Create all charts in the header ribbon
    _buildCharts: function() { //{{{
        if(_.every(this.globalGridCount, function(elem) { return elem===0;})) {
            this.down('#ribbon').add({
                xtype: 'component',
                html: '<b><font color="green" size=18>Congrats! The Train is healthy for this release</font></b>'
            });
        } else {
            console.log('Now building charts');
            this.down('#ribbon').add({
                xtype: 'component',
                layout: {align: 'stretch', pack: 'center', margin: '40px'},
                html: '&emsp;&emsp;&emsp;&emsp;'
            });
            this._buildRibbon();
            this.down('#ribbon').add({
                xtype: 'component',
                layout: {align: 'stretch', pack: 'center', margin: '40px'},
                html: '&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;'
            });
            this._buildPieChart();
            this._chartsReady = true;
        }
    },//}}}


    _buildRibbon: function() { //{{{
        var linkid = '<app class="jump {state}">{title}:&emsp;<a href="#C{name}">{count}</a><p></app>';
        function compare(a,b) {
            if(a.x < b.x)
                return -1;
            if (a.x > b.x)
                return 1;
            return 0;
        }
        var tempobj = this.globalStoryCount.sort(compare);
        var newhtml = "<br>";
        var line;
        console.log("Building ribbon");
        for(var i=0; i < 8; i++) {
            line = linkid.replace("{name}",tempobj[i].x).replace("{title}",tempobj[i].name).replace("{count}",tempobj[i].y);
            if (tempobj[i].y === 0)
                line = line.replace("{state}", "healthy");
            else
                line = line.replace("{state}", "unhealthy");
            newhtml =  newhtml.concat(line);
        }
        this.down('#ribbon').add({
            xtype: 'component',
            layout: {align: 'stretch', pack: 'center', margin: '40px'},
            itemId: 'ribbondata',
            html: newhtml
        });        

    }, //}}}

    _buildPieChart: function() { //{{{
        var tempobj = _.map(this.globalStoryCount, 
                            function(value) { return[value.name, value.y]; });
        this.down('#ribbon').add({
            xtype: 'rallychart',
            flex: 1,
            layout: {
                //align: 'stretch',
                //pack: 'center'
            },
            scope: this,
            chartConfig: { 
                chart: {
                    plotBackgroundColor: null,
                    plotBorderWidth: 0,//null,
                    plotShadow: false//,
                    //width: 800,
                    //height: 600
                },
                title: {
                    text: null // 'Grid ** Count'
                },
                tooltip: {enabled: false},
                plotOptions: {
                    pie: {
                        allowPointSelect: true,
                        cursor: 'pointer',
                        dataLabels: {
                            enabled: true,
                            //distance: 25,
                            format: '<b>{point.name}</b>: {y}',
                            style: {color: 'black'}
                        },
                        startAngle: -90,
                        endAngle: 90
                        //center: ['50%','20%']
                    }
               }
            }, 
            chartData: { 
                series: [{
                    type: 'pie',
                    name: 'Grid Count',
                    innerSize: '40%',
                    data: tempobj//this.globalGridCount
                }]
            }    
        });
    }, //}}}

    // Create all grids in the left/right columns
    _buildGrids: function(scope) { //{{{

        var grids = [ //{{{
        {
            title: 'Blocked Stories',
            model: 'User Story',
            listeners: { scope: this },
            columns: ['FormattedID', 'Name', {text: 'Teams', dataIndex: 'Project'}, 'Blocked', 'BlockedReason'],
            side: 'Left',    // TODO: ensure camelcase format to match itemId names
            pageSize: 3,
            filters: function() {
                return Ext.create('Rally.data.wsapi.Filter', {
                    property: 'blocked', operator: '=', value: 'true' });
            },
            chartnum: 'C1'
        },
        {   
            title: 'Unsized Stories with Features',
            model: 'User Story',
            listeners: { scope: this },
            columns: ['FormattedID', 'Name', {text: 'Teams', dataIndex: 'Project'}, 'Feature','PlanEstimate'],
            side: 'Left',    // TODO: ensure camelcase format to match itemId names
            pageSize: 3,
            filters: function() {
                var featureFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Feature', operator: '!=', value: 'null' });
                var noPlanEstimateFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlanEstimate', operator: '=', value: 'null' });
                return featureFilter.and(noPlanEstimateFilter);
            },
            chartnum: 'C2'
        },
        {
            title: 'Unsized Stories with Release',
            model: 'User Story',
            listeners: { scope: this },
            columns: ['FormattedID', 'Name', {text: 'Teams', dataIndex: 'Project'}, 'PlanEstimate'],
            side: 'Left',    // TODO: ensure camelcase format to match itemId names
            pageSize: 3,
            filters: function() {
                var releaseFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Release', operator: '!=', value: 'null' });
                var noPlanEstimateFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlanEstimate', operator: '=', value: 'null' });
                return releaseFilter.and(noPlanEstimateFilter);
            },
            chartnum: 'C3'
        },
        {
            title: 'Features with no stories',
            model: 'PortfolioItem/Feature',
            listeners: { scope: this },
            columns: ['FormattedID', 'Name', 'PlannedEndDate'],
            side: 'Right',    // TODO: ensure camelcase format to match itemId names
            pageSize: 3,
            filters: function() {
                var userstoryFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'UserStories.ObjectID', operator: 'contains', value: 'null'  });
                var noPlanEstimateFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlannedEndDate', operator: '<', value: 'NextWeek' });
                return userstoryFilter.and(noPlanEstimateFilter);
            },
            chartnum: 'C4'
        },
        {
            title: 'Stories attached to Feature without Iteration',
            model: 'UserStory',
            listeners: { scope: this },
            columns: ['FormattedID', 'Name', 'Feature','Iteration'],
            side: 'Left',    // TODO: ensure camelcase format to match itemId names
            pageSize: 3,
            filters: function() {
                var featureFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Feature', operator: '!=', value: 'null' });
                var noPlanEstimateFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Iteration', operator: '=', value: 'null' });
                return featureFilter.and(noPlanEstimateFilter);
            },
            chartnum: 'C5'
        },
        {
            title: 'Features with unaccepted stories in past sprints',
            model: 'UserStory',
            listeners: { scope: this },
            columns: [    
                {text: 'Feature', dataIndex: 'Feature', flex: 3, 
                    renderer: function(value) { return value.FormattedID.link("https://rally1.rallydev.com/#/"+value.Project.ObjectID+"d/detail/portfolioitem/feature/"+value.ObjectID);}},
                'FormattedID', 'Name',{text:'Teams', dataIndex:'Project'}, 'ScheduleState'
            ],
            side: 'Right',    // TODO: ensure camelcase format to match itemId names
            pageSize: 3,
            filters: function() {
                var featureFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Feature', operator: '!=', value: 'null' });
                var enddateFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Iteration.EndDate', operator: '<', value: 'Today' });
                var unacceptedFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'ScheduleState', operator: '<', value: 'Accepted' });
                return featureFilter.and(unacceptedFilter).and(enddateFilter);
            },
            chartnum: 'C6'
        },
        {
            title: 'Improperly Sized Stories',
            model: 'User Story',
            listeners: { scope: this },
            columns: ['FormattedID', 'Name', {text: 'Teams', dataIndex: 'Project'}, 'PlanEstimate'],
            side: 'Left',    // TODO: ensure camelcase format to match itemId names
            pageSize: 3,
            filters: function() {
                var noPlanEstimateFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlanEstimate', operator: '!=', value: 'null' });
                var planSizeOne = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlanEstimate', operator: '!=', value: '1' });
                var planSizeTwo = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlanEstimate', operator: '!=', value: '2' });
                var planSizeFour = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlanEstimate', operator: '!=', value: '4' });
                var planSizeEight = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlanEstimate', operator: '!=', value: '8' });
                var planSizeSixteen = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'PlanEstimate', operator: '!=', value: '16' });
                return noPlanEstimateFilter.and(planSizeOne).and(planSizeTwo).
                    and(planSizeFour).and(planSizeEight).and(planSizeSixteen);
            },
            chartnum: 'C7'
        },
        {
            title: 'Stories with Iteration in Release but no Release scoped',
            model: 'User Story',
            listeners: { scope: this },
            columns: ['FormattedID', 'Name', {text:'Teams', dataIndex: 'Project'}, 'Release'],
            side: 'Left',    // TODO: ensure camelcase format to match itemId names
            pageSize: 3,
            filters: function() {
                var releaseFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Release', operator: '!=', value: 'null' });
                var releaseDateFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Release.ReleaseDate', operator: '>', value: 'today' });
                var iterationFilter = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Iteration', operator: '=', value: 'null' });
                return releaseFilter.and(releaseDateFilter).and(iterationFilter);
            },
            chartnum: 'C8'
        }

    ]; //}}}

    var allPromises = [];

    //var appscope = this.getContext().getGlobalContext();
    console.log('App scope ', scope);
    _.each(grids, function(grid) {
        promise = this._addGrid(grid.title, grid.model, grid.columns, grid.filters, grid.side, grid.chartnum,scope);
        promise.then({
            success: function(count, key) {
                this.globalGridCount.push(count[0]);
                this.globalGridMap[count[1]]=count[0];
                this.globalStoryCount.push(count[2]);
            },
            error: function(error) { console.log('single: error', error); },
            scope: this
        }).always(function() { });
        allPromises.push(promise);
    }, this);
    Deft.promise.Promise.all(allPromises).then({
        success: function() {
            console.log('All grids have loaded');//this.globalGridCount);
            this._gridsLoaded = true;
            this.down('#ribbon').show();
            this._buildCharts();
            window.newscope=false;
            //this._refreshGrids();
        },
        failure: function(error) { console.log('all error!', error); },
        scope: this
    });

    }, //}}}

    // Utility function to generically build a grid and add to a container with given specs
    _addGrid: function(myTitle, myModel, myColumns, myFilters, gridSide,cnum,scope) { //{{{
        var linkid = '<a id={name}>{title}</a>';
        var deferred = Ext.create('Deft.Deferred');
        // lookup left or right side
        var gridContainer = this.down('#grids' + gridSide);
        var grid = Ext.create('Rally.ui.grid.Grid', {
            xtype: 'rallygrid',
            itemId: cnum,
            title: linkid.replace('{name}',cnum).replace('{title}',myTitle),
            columnCfgs: myColumns,
            showPagingToolbar: true,
            emptyText: 'This search is healthy',
            enableBulkEdit: true,
            pagingToolbarCfg: {
                pageSizes: [15, 25, 100],
                autoRender: true,
                resizable: true
            },
            storeConfig: { //{{{
                model: myModel,
                autoLoad:{start: 0, limit: 15},
                pageSize: 15,
                pagingToolbarCfg: {
                    pageSizes: [15,25,100],
                    autoRender: true,
                    resizable: true
                },
                filters: [this.getContext().getTimeboxScope().getQueryFilter(),myFilters()],
                listeners: {
                    load: function(store) {
                        var tempcount=store.getTotalCount();
                        var elem = {
                            name : myTitle,
                            x: cnum.charAt(1),
                            y: tempcount
                        };
                        if (tempcount === 0) {
                            this.shouldiaddgrid=true;
                        } else
                            gridContainer.add(grid);
                        if(window.newscope) {
                            deferred.resolve([store.getTotalCount(),String(cnum),elem]);
                        } 
                        console.log("Loaded grid",cnum);
                    }   
                },
                scope: this
            }, //}}}
            style: {
                borderColor: '#AAA',
                borderStyle: 'dotted',
                borderWidth: '2px'
            },
            padding: 10,
            syncRowHeight: false,
            scope: this
        });
        // show me the grid!
        if (this.shouldiaddgrid)
        { 
            grid.setBodyStyle("backgroundColor","#00ff00"); 
            grid.setBodyStyle("textDecoration","overline"); 
        }
        //gridContainer.add(grid);
        if (!this._gridsLoaded) 
            { return deferred.promise; }
        this._refreshGrids();
        return true;
    } //}}}


});

