var i = 0;

checkStatus = function(uuid){
    $.ajax({
        url: "/cart/id-" + uuid, 
        success: function(result, textStatus){
            if(result) {
                if(result.redirect) {
                    $("#message").html('Adding to cart!').addClass('alert-success');
                    window.location.replace(result.redirect);
                }
                $("#message").html(result.message).addClass('alert-danger');
                if(result.delay > 0) {
                    setTimeout(function(){checkStatus(uuid)}, result.delay);
                    $("#count").html(result.count);
                    $('#loader').show();
                }
                else {
                    $('#loader').hide();
                }
            }
        },
        error: function(result, textStatus){
            console.log(textStatus);
        }
    });
}

$( document ).ready(function() {
    if( $('#uuid')[0].value ) 
        checkStatus($('#uuid')[0].value);
});