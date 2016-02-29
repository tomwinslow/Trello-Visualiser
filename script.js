//highlighting toggle variable
var toggleHighlight = 0;
//array logging what is connected to what
var linkedByIndex = {};
//width and height of vis container
var width = 0;
var height = 0;
//variable array for node and link data structured for D3.js force graph
var links = [];
var nodes = [];
var data = {};

var force;
var svg;
var link;
var node;


var toggleLoggedIn = false;


//trello application public key
var appKeyPubic = "1b8deaddc3db7010c399a61c710147ae";

//trelloLastLoggedInId
var trelloLastLoggedInId = "";


//var to hold all data loaded from trello
var trelloMasterData = {};
var listOfDataToGather = [];


function initialise() {
  //check to see if user is logged in
  checkCookie('trelloLastLoggedInId');
  //set the width and height vars
  width = $('#visContainer').width();
  height = $('#visContainer').height();
}

//trello authentication / login
var authenticationSuccess = function() {
  //login was a success
  //update the welcome message/page title with the user's name
  Trello.get('members/me', function(member){
      $("#welcomeMsg").text("Welcome, " + member.fullName);
      //and update the cookie
      setCookie('trelloLastLoggedInId',member.id,365);
    }
  );

  //update the log in/out buttons
  $('#loggedOut').fadeOut(300,function(){
    $('#loggedIn').fadeIn(500);
    //show the visualisation elements
    $('#introText').fadeOut(300,function(){
      $('#visElements').fadeIn(300);
      //
      $('#loggedOut').remove();
      $('#introText').remove();
      toggleLoggedIn = true;
      whichDataToLoad();
    });
  });

  //now get a list of all the users boards
  getBoards();
};

var authenticationFailure = function() {
  //authentication failed
  //update the log in/out buttons
  $('#loggedIn').fadeOut(300,function(){
    $('#loggedOut').fadeIn(500);
    $('#visElements').fadeOut(300,function(){
      $('#introText').fadeIn(300);
      //
      toggleLoggedIn =  false;
      whichDataToLoad();
    });
  });
};

//cookie auth functions
function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cName) {
    var name = cName + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
}

function checkCookie(cName) {
    trelloLastLoggedInId = getCookie(cName);
    if (trelloLastLoggedInId != "") {
      //attempt to authorise the user
      loginWithTrelloNoPopUp();
    } else {
      $('#loggedIn').fadeOut(100,function(){
        $('#loggedOut').fadeIn(1000);
        $('#visElements').fadeOut(300,function(){
          $('#introText').fadeIn(300);

            //
            toggleLoggedIn =  false;
            whichDataToLoad();

        });
      });
    }
}



function whichDataToLoad() {

  if(toggleLoggedIn==true)
  {
    //do not load any visulisation
    //setup the force
    setupForce();

    //document.getElementById('visContainer').innerHTML = "<br /><br /><br /><br /><br /><br /><br /><h4 class='text-center text-muted'><span class='glyphicon glyphicon-alert'></span> No board selected</h3>";
    data = {};
    data['nodes'] = [];
    data['links'] = [];

  }
  else
  {
    //load the example data
    //get the example Data if not logged in
    d3.json("example-trello-data.json", function(error, exampleTrelloData) {

      //setup the force
      setupForce();
      data = {};
      data['nodes'] = [];
      data['links'] = [];
      listOfDataToGather = ['labels','members','lists','cards'];
      processDataIntoVisulisation(exampleTrelloData,"56be02a2e8d9a89af6f5a544",listOfDataToGather);

    });
  }
}

function destroyCookie(cName) {
  setCookie(cName, "", 0);
}

function loginWithTrello(){
  Trello.authorize({
    type: 'popup',
    name: 'Trello Data Visuliser',
    scope: {
      read: true,
      write: false },
    expiration: 'never',
    success: authenticationSuccess,
    error: authenticationFailure
  });
}

function loginWithTrelloNoPopUp(){
  Trello.authorize({
    interactive: false,
    persist: true,
    scope: {
      read: true,
      write: false },
    expiration: 'never',
    success: authenticationSuccess,
    error: authenticationFailure
  });
}

function logoutWithTrello(){
  //de-auth trello app
  Trello.deauthorize();
  //destroy the cookie
  destroyCookie("trelloLastLoggedInId");
  //reload the page to clear any old vars out
  location.reload();
}



//-------------------------------------
// trello data object functions
//--------------------------------------
function getBoards() {
  //get all of the boards
  var success = function(successJsonData) {
    //loop through all of the boards - and add each to th eselect menu
    var select = document.getElementById("visElements");
    for(var i = 0; i < successJsonData.length; i++) {
        var boardObj = successJsonData[i];
        var option = document.createElement('option');
        option.text = boardObj.name;
        option.value = boardObj.id;
        select.add(option, 0);
    }

    //create a blank option
    option = document.createElement('option');
    option.text = "Select a board...";
    option.value = "";
    select.add(option, 0);
  };
  var error = function(errorMsg) {
    alert(JSON.stringify(errorMsg));
  };
  Trello.get('/members/me/boards', success, error);
}



function getAllTrelloDataByBoardById(boardId) {

  //check the board id is not null
  if(boardId != "" || boardId != null)
  {
    //create a blank holde for the data relating to the selected board
    trelloMasterData[boardId] = {};
    //state the list of data sets to gather
    listOfDataToGather = ['labels','members','lists','cards','checklists'];
    //get all labels associated with a board
    getTrellodDataByUriString('/boards/'+boardId+'/labels','labels',boardId);
    //get all members associated with a board
    getTrellodDataByUriString('/boards/'+boardId+'/members','members',boardId);
    //get all lists associated with a board
    getTrellodDataByUriString('/boards/'+boardId+'/lists','lists',boardId);
    //get all lists associated with a board
    getTrellodDataByUriString('/boards/'+boardId+'/checklists','checklists',boardId);

  }
}

//generic function for retrieving trello data from a known uri
function getTrellodDataByUriString(uriString,dataName,boardId) {
  var success = function(successJsonData) {
    //success
    addJsonDataToMaster(JSON.stringify(successJsonData),dataName,boardId);
  };
  var error = function(errorMsg) {
    //failed
    return false;
  };
  Trello.get(uriString, success, error);
}


//set global var fro checking whether all card data has been retrieved
var cardListsToCollect = 0;
var cardListsCollected = -1;

function addJsonDataToMaster(newJsonString,dataName,boardId) {
  //JSON parse the json string into an object
  var jsonObj = JSON.parse(newJsonString);
  //check if name is in the json obj already for the specific board?
  if(trelloMasterData[boardId][dataName] === undefined)
  {
      //no - so add it
      trelloMasterData[boardId][dataName] = jsonObj;
  }
  else
  {
      //yes - so apend data to existing
      //loop through new data and Add
      for (var iii = 0; iii < jsonObj.length; iii++) {
        //push
        trelloMasterData[boardId][dataName].push(jsonObj[iii]);
      }
  }

  //if name is lists and lists have not been seen before
  //then get the details for all cards for each list
  if(dataName == 'lists')
  {
    //set the number of card lists to collect and reset the number collected to zero
    cardListsToCollect = jsonObj.length;
    cardListsCollected = 0;
    //loop through lists collecting cards
    var ii = 0;
    for (ii = 0; ii < jsonObj.length; ii++) {
      //get all cards for each list associated with a board
      getTrellodDataByUriString('lists/'+jsonObj[ii].id+'/cards','cards',boardId);
    }
  }

  if(dataName == 'cards')
  {
    //add one to the number of card lists collected
    cardListsCollected += 1;
  }

  //once all required data has been collected it's time to processe it
  var isAllDataColected = true;
  var i = 0;
  for (i = 0; i < listOfDataToGather.length; i++) {
    if(trelloMasterData[boardId][listOfDataToGather[i]] === undefined)
    {
        //no - so change status to false
        isAllDataColected = false;
    }
  }
  if(isAllDataColected === true && cardListsToCollect == cardListsCollected){
    //all data is now collected
    //so lets start processing it
    processDataIntoVisulisation(trelloMasterData,boardId,listOfDataToGather);
  } else {
    //do nothing
  }
}


function addNode(nodeId,nodeName,nodeType) {
  //loop through node list to check whether the node already exists, before it is added again
  var matchFound = 0;
  for (var iii = 0; iii < data['nodes'].length; iii++) {
    if(data['nodes'][iii]['id']==nodeId)
    {
      //match found - so set to true
      matchFound = 1;
    }
  }

  //if matchFound = 0 then add the new node
  if(matchFound == 0)
  {
    data['nodes'].push({"id":nodeId,"name":nodeName,"type":nodeType});
  }
}


function processDataIntoVisulisation(jsonData,boardId,listOfDataToGather) {

  //reset the data array with blank nodes and links
  data = {};
  data['nodes'] = [];
  data['links'] = [];

  //loop through all board data and add to visualisation
  for (i = 0; i < listOfDataToGather.length; i++) {
    //loop through json Data to analyse each set of data
    for (ii = 0; ii < jsonData[boardId][listOfDataToGather[i]].length; ii++) {

      //node name
      var nodeName = "";
      //node id
      var nodeId = listOfDataToGather[i]+jsonData[boardId][listOfDataToGather[i]][ii]['id'];
      //node type
      var nodeType = listOfDataToGather[i].substr(0,listOfDataToGather[i].length - 1);

      if(listOfDataToGather[i] == 'labels')
      {
        //node name
        nodeName = jsonData[boardId][listOfDataToGather[i]][ii]['name'];
        if(nodeName=="")
        {
            //use the color name as the node name
            nodeName = jsonData[boardId][listOfDataToGather[i]][ii]['color'];
        }
        addNode(nodeId,nodeName,nodeType);
      }
      else if(listOfDataToGather[i] == 'members')
      {
        //node name
        nodeName = jsonData[boardId][listOfDataToGather[i]][ii]['fullName']+" ("+jsonData[boardId][listOfDataToGather[i]][ii]['username']+")";
        addNode(nodeId,nodeName,nodeType);
      }
      else if(listOfDataToGather[i] == 'lists')
      {
        //node name
        nodeName = jsonData[boardId][listOfDataToGather[i]][ii]['name'];
        addNode(nodeId,nodeName,nodeType);
      }
      else if(listOfDataToGather[i] == 'cards')
      {
        //node name
        nodeName = jsonData[boardId][listOfDataToGather[i]][ii]['name'];
        addNode(nodeId,nodeName,nodeType);
      }
      else if(listOfDataToGather[i] == 'checklists')
      {
        //node name
        nodeName = jsonData[boardId][listOfDataToGather[i]][ii]['name'];
        addNode(nodeId,nodeName,nodeType);
        //now loop through all of the check list items
        for (iii = 0; iii < jsonData[boardId][listOfDataToGather[i]][ii]['checkItems'].length; iii++) {
          nodeId = "checklistitems"+jsonData[boardId][listOfDataToGather[i]][ii]['checkItems'][iii]['id'];
          nodeName = jsonData[boardId][listOfDataToGather[i]][ii]['checkItems'][iii]['name'];
          nodeType = "checklistitem"
          addNode(nodeId,nodeName,nodeType);
        }
      }

      //load the new data in the force
      loadNewD3Data(data);
    }
  }

  //now that all of the nodes have been created its time to
  //re-loop through all of the cards and create the links
  for (i = 0; i < jsonData[boardId]['cards'].length; i++) {
    var cardId = "cards"+jsonData[boardId]['cards'][i]['id'];
    //user the card as the source for the link
    //loop throug the nodes to find it's position
    var sourcePosition = "";
    for (ii = 0; ii < data['nodes'].length; ii++) {
      if(data['nodes'][ii]['id']==cardId)
      {
        //grab the source
        sourcePosition = ii;
      }
    }

    //connect card to assigned members
    for (ii = 0; ii < jsonData[boardId]['cards'][i]['idMembers'].length; ii++) {
      //store the meber id in a var
      var memberId = "members"+jsonData[boardId]['cards'][i]['idMembers'][ii];
      //now loop through all of the nodes to find the correct node for the member
      for (iii = 0; iii < data['nodes'].length; iii++) {
        if(data['nodes'][iii]['id']==memberId)
        {
          //target
          var targetPosition = iii;
          //add the link to the data
          data['links'].push({"source":sourcePosition,"target":targetPosition,"value":120});
          //add the data
          loadNewD3Data(data);
        }
      }
    }

    //connect card to assigned labels
    for (ii = 0; ii < jsonData[boardId]['cards'][i]['idLabels'].length; ii++) {
      //store the label id in a var
      var labelId = "labels"+jsonData[boardId]['cards'][i]['idLabels'][ii];
      //now loop through all of the nodes to find the correct node for the label
      for (iii = 0; iii < data['nodes'].length; iii++) {
        if(data['nodes'][iii]['id']==labelId)
        {
          //target
          var targetPosition = iii;
          //add the link to the data
          data['links'].push({"source":sourcePosition,"target":targetPosition,"value":80});
          //add the data
          loadNewD3Data(data);
        }
      }
    }

    //connect card to assigned lists
    //store the list id in a var
    var listId = "lists"+jsonData[boardId]['cards'][i]['idList'];
    //now loop through all of the nodes to find the correct node for the list
    for (iii = 0; iii < data['nodes'].length; iii++) {
      if(data['nodes'][iii]['id']==listId)
      {
        //target
        var targetPosition = iii;
        //add the link to the data
        data['links'].push({"source":sourcePosition,"target":targetPosition,"value":50});
        //add the data
        loadNewD3Data(data);
      }
    }


    //connect card to its checklists
    for (ii = 0; ii < jsonData[boardId]['cards'][i]['idChecklists'].length; ii++) {
      //store the checklist id in a var
      var checklistId = "checklists"+jsonData[boardId]['cards'][i]['idChecklists'][ii];
      //now loop through all of the nodes to find the correct node for the member
      for (iii = 0; iii < data['nodes'].length; iii++) {
        if(data['nodes'][iii]['id']==checklistId)
        {
          //target
          var targetPosition = iii;
          //add the link to the data
          data['links'].push({"source":sourcePosition,"target":targetPosition,"value":30});
          //add the data
          loadNewD3Data(data);
        }
      }
    }

    //connect card to assigned boards
    //store the label id in a var
    /*
    var boardId = "boards"+jsonData[boardId]['cards'][i]['idBoard'];
    //now loop through all of the nodes to find the correct node for the board
    for (iii = 0; iii < data['nodes'].length; iii++) {
      if(data['nodes'][iii]['id']==boardId)
      {
        //target
        var targetPosition = iii;
        //add the link to the data
        data['links'].push({"source":sourcePosition,"target":targetPosition,"value":1});
        //add the data
        loadNewD3Data(data);
      }
    }
    */
  }

  //loop through all of the checklists and create the links
  for (i = 0; i < jsonData[boardId]['checklists'].length; i++) {
    var checklistId = "checklists"+jsonData[boardId]['checklists'][i]['id'];
    //use the checklist as the source for the link
    //loop through the nodes to find it's position
    var sourcePosition = "";
    for (ii = 0; ii < data['nodes'].length; ii++) {
      if(data['nodes'][ii]['id']==checklistId)
      {
        //grab the source
        sourcePosition = ii;
      }
    }

    //connect checklist to its checklist items
    //store the checklistitem id in a var
    for (ii = 0; ii < jsonData[boardId]['checklists'][i]['checkItems'].length; ii++) {
      //store the checklistitem id in a var
      var checklistItemId = "checklistitems"+jsonData[boardId]['checklists'][i]['checkItems'][ii]['id'];
      //now loop through all of the nodes to find the correct node for the check list item
      for (iii = 0; iii < data['nodes'].length; iii++) {
        if(data['nodes'][iii]['id']==checklistItemId)
        {
          //target
          var targetPosition = iii;
          //add the link to the data
          data['links'].push({"source":sourcePosition,"target":targetPosition,"value":5});
          //add the data
          loadNewD3Data(data);
        }
      }
    }
  }
  //update the array with all of the connections - for the highlighting function
  updateLinkedByIndexArray(data);
}



//-------------------------------------
// D3.js functions
//--------------------------------------

function setupForce() {
  //set up the force
  force = d3.layout.force()
      .nodes(nodes)
      .links(links)
      .size([width, height])
      .linkDistance(function(d){ return d.value;})
      .charge(-300)
      .on("tick", tick);

    //reset

    if(svg)
    {

    }
    else
    {
      svg = d3.select("#visContainer").append("svg")
          .attr("width", width)
          .attr("height", height);
    }

    link = svg.selectAll(".link");
    node = svg.selectAll(".node");
}

function loadNewD3Data(jsonData){

  links = jsonData.links;
  nodes = jsonData.nodes;

  //NEW LINK Data
  force.links(links);
  link = link.data(force.links());
  link.enter().insert("line",".g").attr("class", "link");
  link.exit().remove();

  //NEW NODE DATA
  force.nodes(nodes);
  node = node.data(force.nodes());
  node.enter().append("g")
      .attr("class", "g")
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .on('click', function(){connectedNodes(this);})
      .call(force.drag);
  node.exit().remove();

  //remove old elements
  svg.selectAll("text").remove();
  svg.selectAll("circle").remove();

  node.append("circle")
      .attr("class", "node")
      .attr("r", function(d) { return sizeNodeByType(d); })
      .style("fill", function(d) { return colorNodeByType(d); })
      .on('dblclick', function(d){actionOnNodeClick(d);})
      node.exit().remove();

  node.append("text")
      .attr("x", 20)
      .attr("dy", ".35em")
      //.attr("text-anchor", "middle")
      .attr("fill", "#000")
      .attr("class", "nodeLabel")
      .on('click', function(d){actionOnNodeClick(d);})
      .text(function(d) { return d.name; });

  //resize the force graph
  force.size([width, height]);
  //start the force
  force.start();
}


function tick() {

  link
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

  node
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}

//node sizing
function sizeNodeByType(d){
  var nodeType = d.type;
  if(nodeType=='label')
  {
    //node represents a space
    return 10;
  }
  else if(nodeType=='member')
  {
    //node represents a feed
    return 10;
  }
	else if(nodeType=="list")
  {
    //node represents a data field of a feed
    return 10;
  }
  else if(nodeType=="card")
  {
    //node represents
    return 10;
  }
  else if(nodeType=="checklist")
  {
    //node represents
    return 6;
  }
  else if(nodeType=="checklistitem")
  {
    //node represents
    return 3;
  }
}

//node coloring
function colorNodeByType(d){
  var nodeType = d.type;
  if(nodeType=='label')
  {
    //node represents a data field of a feed
    return "#ff9900";
  }
  else if(nodeType=='member')
  {
    //node represents a data field of a feed
    return "#ff0000";
  }
	else if(nodeType=="list")
  {
    //node represents a data field of a feed
    return "#00ff00";
  }
	else if(nodeType=="card")
  {
    //node represents a data field of a feed
    return "#0000ff";
  }
  else if(nodeType=="checklist")
  {
    //node represents a data field of a feed
    return "#999999";
  }
  else if(nodeType=="checklistitem")
  {
    //node represents a data field of a feed
    return "#cccccc";
  }
}

function mouseover(d) {
	var newSize = 0
	var nodeType = d.type;
	if(nodeType=='label')
	{
		//node represents a board
		newSize = 10;
	}
	else if(nodeType=='member')
	{
		//node represents a list
		newSize = 10;
	}
	else if(nodeType=="list")
	{
		//node represents a member
		newSize = 10;
	}
	else if(nodeType=="card")
	{
		//node represents a data field of a feed
		newSize = 10;
	}
  else if(nodeType=="checklist")
  {
    //node represents
    newSize = 6;
  }
  else if(nodeType=="checklistitem")
  {
    //node represents
    newSize = 3;
  }

	newSize = newSize * 2;
  d3.select(this).select("circle").transition()
      .duration(750)
      .attr("r", newSize);

  d3.select(this).select("text").transition()
      .duration(750)
      .style("font-size", "24px");
}


function mouseout(d) {
	var newSize = 0
	var nodeType = d.type;
	if(nodeType=='label')
	{
		//node represents a space
		newSize = 10;
	}
	else if(nodeType=='member')
	{
		//node represents a feed
		newSize = 10;
	}
	else if(nodeType=="list")
	{
		//node represents a data field of a feed
		newSize = 10;
	}
	else if(nodeType=="card")
	{
		//node represents a data field of a feed
		newSize = 10;
	}
  else if(nodeType=="checklist")
  {
    //node represents
    newSize = 6;
  }
  else if(nodeType=="checklistitem")
  {
    //node represents
    newSize = 3;
  }

	tempNewSize = newSize / 2;
	d3.select(this).select("circle").transition()
			.duration(1000)
			.attr("r", newSize);

  d3.select(this).select("text").transition()
      .duration(1000)
      .style("font-size", "0px");
}

//this function creates an updated version of the linked by index array - depending on what nodes/links are showing
function updateLinkedByIndexArray(inputData){
  //reset the array
  linkedByIndex = {}
  //create the array data
  for (var i = 0; i < inputData.nodes.length; i++) {
      linkedByIndex[i + "," + i] = 1;
  };
  inputData.links.forEach(function (d) {
    //alert(d.source.index + "," + d.target.index);
      linkedByIndex[d.source.index + "," + d.target.index] = 1;
  });
}

//This function looks up whether a pair are neighbours
function neighboring(a, b) {
    return linkedByIndex[a.index + "," + b.index];
}
function connectedNodes(selectedNode) {
    if (toggleHighlight == 0) {
        //Reduce the opacity of all but the neighbouring nodes
        d = d3.select(selectedNode).node().__data__;
        node.style("opacity", function (o) {
            return neighboring(d, o) | neighboring(o, d) ? 1 : 0.1;
        });
        link.style("opacity", function (o) {
            return d.index==o.source.index | d.index==o.target.index ? 1 : 0.05;
        });
        //Reduce the op
        toggleHighlight = 1;
    } else {
        //Put them back to opacity=1
        node.style("opacity", 1);
        link.style("opacity", 1);
        toggleHighlight = 0;
    }
}
